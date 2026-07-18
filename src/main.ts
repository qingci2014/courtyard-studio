import "./styles.css";
import rawData from "./data/course-data.json";
import type { CourseData, Filters, Lesson, Module } from "./types";
import { filterLessons, lessonHash, loadProgress, saveProgress, shouldUseSimplifiedGalaxy, validateCourse } from "./utils";
import { initLabs } from "./labs";

const data = rawData as CourseData;
const validationErrors = validateCourse(data);
if (validationErrors.length) throw new Error(`课程数据校验失败：${validationErrors.join("；")}`);

const moduleById = new Map(data.modules.map((module) => [module.id, module]));
const progress = loadProgress(data.lessons);
const state: { filters: Filters; view: "grid" | "list"; activeLesson: Lesson | null } = {
  filters: { query: "", module: "", competency: "", level: "" },
  view: "grid",
  activeLesson: null
};
let lastLessonTrigger: HTMLElement | null = null;
let galaxyController: { setCompleted: (ids: Set<string>) => void; setVisibleLessons: (ids: Set<string>) => void } | null = null;

const pad = (value: number) => String(value).padStart(2, "0");
const moduleFor = (lesson: Lesson) => moduleById.get(lesson.moduleId)!;
const lessonsForModule = (module: Module) => data.lessons.filter((lesson) => lesson.moduleId === module.id);
const conceptsForModule = (module: Module) => [...new Set(lessonsForModule(module).flatMap((lesson) => lesson.concepts))];

const conceptStudyPrompts = data.studyScaffolds.conceptPrompts;

function lessonButton(lesson: Lesson, compact = false): string {
  const module = moduleFor(lesson);
  return `<article class="lesson-card${compact ? " compact" : ""}" data-lesson-card="${lesson.id}" style="--module:${module.color}">
    <div class="lesson-meta"><span>${pad(lesson.number)}</span><span>第${lesson.week}周 · ${lesson.periodInWeek}</span><span>${module.shortTitle}</span></div>
    <h3>${lesson.title}</h3>
    <p class="lesson-kicker">本课要回答</p>
    <p class="driving-question">${lesson.drivingQuestion}</p>
    ${compact ? "" : `<div class="lesson-knowledge"><strong>核心知识点</strong><ol>${lesson.concepts.map((concept, index) => `<li><span>${index + 1}</span>${concept}</li>`).join("")}</ol></div><p class="lesson-detail outcome"><b>学完能完成</b>${lesson.learningArtifact}</p>`}
    <div class="lesson-footer"><span>${lesson.competencyDimensionLabel} · ${lesson.progressionLevelLabel}</span><div><button class="text-button" data-open-lesson="${lesson.id}">查看详情</button><button class="complete-button" data-toggle-complete="${lesson.id}" aria-pressed="${progress.has(lesson.id)}">${progress.has(lesson.id) ? "✓ 已完成" : "标记完成"}</button></div></div>
  </article>`;
}

function renderApp(): void {
  const projectLessons = data.lessons.filter((lesson) => lesson.number >= 31);
  document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
    <header class="site-header" data-header>
      <a class="brand" href="#overview"><span>AI /</span> GENERAL EDUCATION</a>
      <button class="menu-button" data-menu-button aria-expanded="false" aria-controls="primary-nav"><span></span><span></span><span></span><span class="sr-only">打开导航</span></button>
      <nav id="primary-nav" class="primary-nav" aria-label="主要导航">
        <a href="#overview">课程概览</a><a href="#knowledge">知识地图</a><a href="#galaxy">课程星图</a><a href="#lessons">32课时</a><a href="#labs">互动实验</a><a href="#assessment">考核与项目</a>
      </nav>
      <div class="header-actions"><div class="progress-mini" data-progress-summary>已完成 ${progress.size} / 32</div><a class="button small" href="#galaxy">进入星图</a></div>
    </header>
    <main id="main-content">
      <section class="hero" id="overview" aria-labelledby="hero-title">
        <div class="hero-glow"></div>
        <div class="hero-copy">
          <p class="eyebrow">FRESHMAN AI LITERACY · ${data.meta.totalLessons} LESSONS</p>
          <h1 id="hero-title">${data.meta.siteTagline}</h1>
          <p class="hero-description">${data.meta.siteDescription} 为不同专业的大一学生建立可迁移的人工智能素养。</p>
          <div class="quick-tags"><span>无需编程基础</span><span>${data.meta.semesterWeeks}周</span><span>互动实验</span><span>综合项目</span></div>
          <div class="hero-actions"><a class="button" href="#knowledge">先看知识地图 <span>↓</span></a><a class="button secondary" href="#lessons">查看32课时</a></div>
          <dl class="hero-stats"><div><dt>${data.modules.length}</dt><dd>知识模块</dd></div><div><dt>${data.meta.totalLessons}</dt><dd>完整课时</dd></div><div><dt>${data.featuredLabs.length}</dt><dd>互动实验</dd></div></dl>
        </div>
        <div class="hero-orbit" aria-hidden="true"><div class="orbit orbit-a"></div><div class="orbit orbit-b"></div><div class="orbit-core">AI<span>人 × 技术</span></div>${data.modules.map((module, index) => `<i style="--i:${index};--c:${module.color}"></i>`).join("")}</div>
      </section>

      <section class="section why-section" aria-labelledby="why-title">
        <div class="section-heading"><p class="eyebrow">WHY THIS COURSE</p><h2 id="why-title">建立不会随工具过时的判断力</h2><p>从理解到应用，再到创造；每一步都把人、证据与责任放回流程中。</p></div>
        <div class="outcome-grid">${data.learningOutcomes.slice(0, 4).map((outcome, index) => `<article><span>0${index + 1}</span><h3>${["看懂背后的逻辑", "选择合适的路径", "设计可控的流程", "核验事实与证据"][index]}</h3><p>${outcome}</p></article>`).join("")}</div>
        <blockquote>本课程不培养“会按按钮的人”，而培养能提出好问题、判断证据、设计流程并承担责任的人。</blockquote>
      </section>

      <section class="section knowledge-section" id="knowledge" aria-labelledby="knowledge-title">
        <div class="section-heading split"><div><p class="eyebrow">KNOWLEDGE MAP</p><h2 id="knowledge-title">先看懂学什么，再进入星图</h2></div><p>课程分为8个知识模块。每个模块先告诉你要解决的问题、涉及的核心概念，以及对应课时。</p></div>
        <div class="knowledge-map">${data.modules.map((module) => {
          const moduleLessons = lessonsForModule(module);
          const moduleConcepts = conceptsForModule(module);
          return `<article class="knowledge-module" style="--module:${module.color}">
            <header><span>模块 ${pad(module.order)}</span><small>第${module.lessonRange[0]}–${module.lessonRange[1]}课</small></header>
            <h3>${module.title}</h3>
            <p>${module.description}</p>
            <div class="module-concepts"><strong>你会学到</strong><div>${moduleConcepts.slice(0, 8).map((concept) => `<span>${concept}</span>`).join("")}</div></div>
            <ol class="module-lessons">${moduleLessons.map((lesson) => `<li><button data-open-lesson="${lesson.id}"><span>${pad(lesson.number)}</span>${lesson.title}</button></li>`).join("")}</ol>
            <button class="text-button module-library-link" data-filter-module="${module.id}">查看本模块${moduleLessons.length}课 →</button>
          </article>`;
        }).join("")}</div>
      </section>

      <section class="section galaxy-section" id="galaxy" aria-labelledby="galaxy-title">
        <div class="section-heading split"><div><p class="eyebrow">LEARNING CONSTELLATION</p><h2 id="galaxy-title">课程星图</h2></div><p>8个模块组成一条从基础理解到综合设计的学习轨道。桌面端可探索3D星图；所有信息均有等价的键盘入口。</p></div>
        <div class="galaxy-shell" data-galaxy-host>
          <div class="galaxy-status"><span class="live-dot"></span><span data-galaxy-mode>正在准备交互星图</span><span>· 可点击节点探索</span></div>
          <div class="galaxy-tooltip" data-galaxy-tooltip hidden></div>
          <div class="galaxy-fallback" data-galaxy-fallback aria-label="课程星图模块列表">
            ${data.modules.map((module) => `<article style="--module:${module.color}"><button data-select-module="${module.id}"><span class="node-index">0${module.order}</span><strong>${module.title}</strong><small>第${module.lessonRange[0]}–${module.lessonRange[1]}课</small></button></article>`).join("")}
          </div>
          <aside class="module-panel" data-module-panel aria-live="polite"><span>选择一个模块</span><h3>从星图开始探索</h3><p>8个模块、32个课时，从理解AI到完成一个可验证、负责任的AI方案。</p></aside>
        </div>
      </section>

      <section class="section timeline-section" id="timeline" aria-labelledby="timeline-title">
        <div class="section-heading split"><div><p class="eyebrow">16-WEEK PATH</p><h2 id="timeline-title">16周学习路径</h2></div><p>每周两个课时、一个明确学习产物。桌面端横向浏览，移动端自然转为纵向路径。</p></div>
        <div class="timeline" tabindex="0" aria-label="16周课程时间轴">${Array.from({ length: 16 }, (_, index) => {
          const week = index + 1; const weekLessons = data.lessons.filter((lesson) => lesson.week === week); const module = moduleFor(weekLessons[0]!);
          return `<article style="--module:${module.color}"><div class="week-marker"><span>${pad(week)}</span><i></i></div><p class="week-label">第${week}周 · ${module.shortTitle}</p>${weekLessons.map((lesson) => `<button data-open-lesson="${lesson.id}"><span>${lesson.periodInWeek}</span><strong>${lesson.title}</strong><small>${lesson.competencyDimensionLabel} · ${lesson.progressionLevelLabel}</small></button>`).join("")}<div class="week-artifact"><b>本周产出</b>${weekLessons[1]!.learningArtifact}</div></article>`;
        }).join("")}</div>
      </section>

      <section class="section lessons-section" id="lessons" aria-labelledby="lessons-title">
        <div class="section-heading split"><div><p class="eyebrow">COURSE LIBRARY</p><h2 id="lessons-title">32课时课程库</h2></div><p>每张卡片直接列出核心知识点。点击“查看详情”，按“学什么—怎么理解—如何应用—怎样检查”的顺序阅读。</p></div>
        <div class="filter-panel">
          <label class="search-label"><span class="sr-only">搜索课时</span><input type="search" data-filter="query" placeholder="搜索主题、概念、问题或学习产物…"><i>⌕</i></label>
          <label>模块<select data-filter="module"><option value="">全部模块</option>${data.modules.map((module) => `<option value="${module.id}">0${module.order} · ${module.title}</option>`).join("")}</select></label>
          <label>能力<select data-filter="competency"><option value="">全部能力</option>${data.competencyFramework.dimensions.map((dimension) => `<option value="${dimension.id}">${dimension.label}</option>`).join("")}</select></label>
          <label>层级<select data-filter="level"><option value="">全部层级</option>${data.competencyFramework.levels.map((level) => `<option value="${level.id}">${level.label}</option>`).join("")}</select></label>
          <button class="text-button clear-filter" data-clear-filters>清除筛选</button>
        </div>
        <div class="library-toolbar"><div><p data-result-count aria-live="polite">显示32课中的32课</p><button class="text-button reset-progress" data-reset-progress>重置本地进度</button></div><div class="view-toggle" aria-label="视图模式"><button data-view="grid" aria-pressed="true">▦ <span>网格</span></button><button data-view="list" aria-pressed="false">☰ <span>列表</span></button></div></div>
        <div class="lesson-grid" data-lesson-grid></div>
      </section>

      <section class="section labs-section" id="labs" aria-labelledby="labs-title">
        <div class="section-heading split"><div><p class="eyebrow">INTERACTIVE LABS</p><h2 id="labs-title">把抽象概念变成可操作实验</h2></div><p>四个实验全部在本地运行，不连接外部AI接口。试着改变参数，观察判断如何随情境改变。</p></div>
        <div class="lab-stack">${data.featuredLabs.map((lab, index) => `<article class="lab-card" id="${lab.id}"><header><span>LAB ${String.fromCharCode(65 + index)}</span><div><h3>${lab.title}</h3><p>${lab.description}</p></div><a href="${lessonHash(data.lessons.find((lesson) => lesson.id === lab.lessonId)!)}" data-open-lesson="${lab.lessonId}">关联课时 ↗</a></header><div class="lab-body" data-lab-root="${lab.id}"></div><footer>${lab.implementation}</footer></article>`).join("")}</div>
      </section>

      <section class="section assessment-section" id="assessment" aria-labelledby="assessment-title">
        <div class="section-heading split"><div><p class="eyebrow">ASSESSMENT & PROJECT</p><h2 id="assessment-title">用证据证明学习发生</h2></div><p>总评不是一次考试，而是互动、作品、审计、迁移与综合项目共同组成的证据链。</p></div>
        <div class="assessment-layout">
          <div class="assessment-chart"><div class="donut" style="${data.assessment.map((item, index) => `--w${index}:${item.weight};`).join("")}"><span>100<small>总评</small></span></div><ul>${data.assessment.map((item, index) => `<li><i style="--i:${index}"></i><span>${item.name}</span><strong>${item.weight}%</strong><small>${item.description}</small></li>`).join("")}</ul></div>
          <div class="project-card"><span class="eyebrow">FINAL PROJECT · 30%</span><h3>${projectLessons[0]!.title} → ${projectLessons[1]!.title}</h3><p>${projectLessons[0]!.drivingQuestion}</p><div class="project-steps">${projectLessons.map((lesson) => `<button data-open-lesson="${lesson.id}"><span>${pad(lesson.number)}</span><div><strong>${lesson.title}</strong><small>${lesson.learningArtifact}</small></div></button>`).join("")}</div><h4>五维评分标准</h4>${data.finalProjectRubric.map((item) => `<div class="rubric-row"><span>${item.criterion}</span><i><b style="width:${item.weight * 5}%"></b></i><strong>${item.weight}%</strong></div>`).join("")}</div>
        </div>
      </section>

      <section class="section faq-section" id="faq" aria-labelledby="faq-title">
        <div class="section-heading"><p class="eyebrow">FAQ</p><h2 id="faq-title">开始之前，你可能想知道</h2></div>
        <div class="faq-list">${[
          ["没有编程基础能学吗？", `能。课程面向${data.meta.audience}，重点是直观理解、判断、验证和设计，不以编程为门槛。`],
          ["课程是不是只教提示词？", "不是。提示设计只是32课中的一环，课程还涵盖数据、模型、多模态、检索、智能体、核验、伦理和系统设计。"],
          ["是否需要购买付费AI工具？", "不需要。站内实验全部本地运行；课堂案例可使用学校提供或可替换的工具。"],
          ["作业能不能使用AI？", "可以在任务允许的范围内使用，但需要保留过程、核验输出并披露AI参与方式。"],
          ["如何避免AI代写？", "把作业设计为问题形成、过程记录、证据核验、口头解释和反思的组合，让学习过程本身成为评价对象。"],
          ["期末项目必须写代码吗？", "不必须。可以提交无代码方案、静态原型或交互演示，重点是价值、证据、边界与人工监督。"],
          ["课程内容会不会很快过时？", "课程围绕稳定概念和判断框架组织，具体工具只是可替换案例。工具会变化，任务分析、证据核验和责任设计仍然适用。"]
        ].map(([question, answer]) => `<details><summary>${question}<span>＋</span></summary><p>${answer}</p></details>`).join("")}</div>
      </section>
    </main>
    <footer class="site-footer"><div><a class="brand" href="#overview"><span>AI /</span> GENERAL EDUCATION</a><p>${data.meta.courseTitle}</p></div><div><strong>${data.meta.totalLessons}课时 / ${data.meta.semesterWeeks}周 / 面向大一</strong><p>课程内容由JSON统一维护 · 无外部追踪器 · v1.0</p></div><a href="#overview">返回顶部 ↑</a></footer>

    <dialog class="lesson-dialog" data-lesson-dialog aria-labelledby="dialog-title"><div data-dialog-content></div></dialog>
    <div class="toast" data-toast role="status" aria-live="polite"></div>`;
}

function renderLessons(): void {
  const filtered = filterLessons(data.lessons, state.filters);
  const grid = document.querySelector<HTMLElement>("[data-lesson-grid]")!;
  grid.className = `lesson-grid ${state.view}`;
  grid.innerHTML = filtered.length ? filtered.map((lesson) => lessonButton(lesson)).join("") : `<div class="empty-state"><strong>没有匹配的课时</strong><p>试试更宽泛的关键词或清除筛选。</p><button class="button secondary" data-clear-filters>清除筛选</button></div>`;
  document.querySelector<HTMLElement>("[data-result-count]")!.textContent = `显示${data.lessons.length}课中的${filtered.length}课`;
  document.querySelectorAll<HTMLElement>("[data-lesson-card]").forEach((card) => card.classList.toggle("is-complete", progress.has(card.dataset.lessonCard!)));
  const visibleIds = new Set(filtered.map((lesson) => lesson.id));
  const visibleModules = new Set(filtered.map((lesson) => lesson.moduleId));
  galaxyController?.setVisibleLessons(visibleIds);
  document.querySelectorAll<HTMLButtonElement>("[data-select-module]").forEach((button) => button.classList.toggle("dimmed", !visibleModules.has(button.dataset.selectModule!)));
}

function updateProgressUI(message?: string): void {
  document.querySelector<HTMLElement>("[data-progress-summary]")!.textContent = `已完成 ${progress.size} / 32`;
  document.querySelectorAll<HTMLButtonElement>("[data-toggle-complete]").forEach((button) => {
    const done = progress.has(button.dataset.toggleComplete!);
    button.setAttribute("aria-pressed", String(done)); button.textContent = done ? "✓ 已完成" : "标记完成";
    button.closest("[data-lesson-card]")?.classList.toggle("is-complete", done);
  });
  galaxyController?.setCompleted(progress);
  if (message) {
    const toast = document.querySelector<HTMLElement>("[data-toast]")!; toast.textContent = message; toast.classList.add("show");
    window.setTimeout(() => toast.classList.remove("show"), 2200);
  }
}

function toggleComplete(id: string): void {
  const lesson = data.lessons.find((item) => item.id === id); if (!lesson) return;
  if (progress.has(id)) progress.delete(id); else progress.add(id);
  saveProgress(progress); updateProgressUI(progress.has(id) ? `第${lesson.number}课已标记完成` : `已取消第${lesson.number}课完成状态`);
  if (state.activeLesson?.id === id) renderDialog(lesson);
}

function renderDialog(lesson: Lesson): void {
  const module = moduleFor(lesson); const dialog = document.querySelector<HTMLDialogElement>("[data-lesson-dialog]")!;
  dialog.querySelector<HTMLElement>("[data-dialog-content]")!.innerHTML = `
    <div class="dialog-accent" style="--module:${module.color}"></div>
    <div class="dialog-meta"><span>LESSON ${pad(lesson.number)}</span><span>第${lesson.week}周 · 第${lesson.periodInWeek}课</span><span>${module.title}</span></div>
    <h2 id="dialog-title">${lesson.title}</h2>
    <button class="dialog-close" data-close-dialog aria-label="关闭课时详情">×</button>
    <section class="lesson-reading-block lesson-goal" aria-labelledby="lesson-goal-title">
      <span class="reading-index">01</span><div><p class="reading-label" id="lesson-goal-title">这节课学什么</p><h3>${lesson.drivingQuestion}</h3><p>学完后，你应该能结合下面的核心概念回答这个问题，而不是只记住术语。</p></div>
    </section>
    <section class="lesson-reading-block" aria-labelledby="lesson-concepts-title">
      <span class="reading-index">02</span><div><p class="reading-label" id="lesson-concepts-title">核心知识点</p><ol class="dialog-knowledge-list">${lesson.concepts.map((concept, index) => `<li><span>${pad(index + 1)}</span><div><strong>${concept}</strong><p>${conceptStudyPrompts[index] ?? conceptStudyPrompts[conceptStudyPrompts.length - 1]}</p></div></li>`).join("")}</ol></div>
    </section>
    <section class="lesson-reading-block" aria-labelledby="lesson-activity-title">
      <span class="reading-index">03</span><div><p class="reading-label" id="lesson-activity-title">怎样把概念弄懂</p><div class="dialog-grid"><article><span>课堂案例与活动</span><p>${lesson.inClassActivity}</p></article><article><span>学完能够完成</span><p>${lesson.learningArtifact}</p></article></div></div>
    </section>
    <section class="lesson-reading-block lesson-check" aria-labelledby="lesson-check-title">
      <span class="reading-index">04</span><div><p class="reading-label" id="lesson-check-title">即时自测</p><h3>${data.studyScaffolds.selfCheckInstruction}</h3><p>${lesson.drivingQuestion}</p><details><summary>展开检查要点 <span>＋</span></summary><p>回答中应能准确使用：${lesson.concepts.join("、")}。</p></details></div>
    </section>
    <div class="dialog-badges"><span>${lesson.competencyDimensionLabel}</span><span>${lesson.progressionLevelLabel}</span><span>${lesson.durationMinutes}分钟</span></div>
    <button class="button complete-wide" data-toggle-complete="${lesson.id}" aria-pressed="${progress.has(lesson.id)}">${progress.has(lesson.id) ? "✓ 已完成 · 点击取消" : "完成自测后，标记本课为已完成"}</button>
    <nav class="dialog-nav" aria-label="课时切换"><button data-dialog-step="-1" ${lesson.number === 1 ? "disabled" : ""}>← 上一课</button><span>${pad(lesson.number)} / 32</span><button data-dialog-step="1" ${lesson.number === 32 ? "disabled" : ""}>下一课 →</button></nav>`;
}

function openLesson(id: string, trigger?: HTMLElement): void {
  const lesson = data.lessons.find((item) => item.id === id); if (!lesson) return;
  const dialog = document.querySelector<HTMLDialogElement>("[data-lesson-dialog]")!;
  lastLessonTrigger = trigger ?? null; state.activeLesson = lesson; renderDialog(lesson);
  history.replaceState(null, "", lessonHash(lesson));
  if (!dialog.open) dialog.showModal();
  requestAnimationFrame(() => dialog.querySelector<HTMLButtonElement>("[data-close-dialog]")?.focus());
}

function closeDialog(clearHash = true): void {
  const dialog = document.querySelector<HTMLDialogElement>("[data-lesson-dialog]")!;
  if (dialog.open) dialog.close();
  state.activeLesson = null;
  if (clearHash && location.hash.startsWith("#lesson-")) history.replaceState(null, "", `${location.pathname}${location.search}`);
  lastLessonTrigger?.focus();
}

function selectModule(module: Module): void {
  const lessons = data.lessons.filter((lesson) => lesson.moduleId === module.id);
  const panel = document.querySelector<HTMLElement>("[data-module-panel]")!;
  panel.style.setProperty("--module", module.color);
  panel.innerHTML = `<span>MODULE 0${module.order} · 第${module.lessonRange[0]}–${module.lessonRange[1]}课</span><h3>${module.title}</h3><p>${module.description}</p><div>${lessons.map((lesson) => `<button data-open-lesson="${lesson.id}"><b>${pad(lesson.number)}</b>${lesson.title}</button>`).join("")}</div><button class="text-button" data-filter-module="${module.id}">在课程库中查看 →</button>`;
}

function clearFilters(): void {
  state.filters = { query: "", module: "", competency: "", level: "" };
  document.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-filter]").forEach((control) => { control.value = ""; });
  renderLessons();
}

function bindEvents(): void {
  const menuButton = document.querySelector<HTMLButtonElement>("[data-menu-button]")!;
  const nav = document.querySelector<HTMLElement>("#primary-nav")!;
  const setMenu = (open: boolean) => { menuButton.setAttribute("aria-expanded", String(open)); nav.classList.toggle("open", open); };
  menuButton.addEventListener("click", () => setMenu(menuButton.getAttribute("aria-expanded") !== "true"));
  nav.addEventListener("click", () => setMenu(false));
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    setMenu(false);
    if (document.querySelector<HTMLDialogElement>("[data-lesson-dialog]")?.open) closeDialog();
  });

  document.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const open = target.closest<HTMLElement>("[data-open-lesson]");
    if (open) { event.preventDefault(); openLesson(open.dataset.openLesson!, open); return; }
    const complete = target.closest<HTMLButtonElement>("[data-toggle-complete]"); if (complete) { toggleComplete(complete.dataset.toggleComplete!); return; }
    if (target.closest("[data-close-dialog]")) { closeDialog(); return; }
    const step = target.closest<HTMLButtonElement>("[data-dialog-step]");
    if (step && state.activeLesson) openLesson(data.lessons[state.activeLesson.number - 1 + Number(step.dataset.dialogStep)]!.id); 
    const moduleButton = target.closest<HTMLButtonElement>("[data-select-module]"); if (moduleButton) selectModule(moduleById.get(moduleButton.dataset.selectModule!)!);
    const moduleFilter = target.closest<HTMLButtonElement>("[data-filter-module]"); if (moduleFilter) { state.filters.module = moduleFilter.dataset.filterModule!; document.querySelector<HTMLSelectElement>('[data-filter="module"]')!.value = state.filters.module; renderLessons(); location.hash = "#lessons"; }
    if (target.closest("[data-clear-filters]")) clearFilters();
    if (target.closest("[data-reset-progress]")) {
      if (!progress.size) updateProgressUI("当前没有已完成课时");
      else if (window.confirm(`确定重置 ${progress.size} 个已完成课时吗？此操作只影响本设备。`)) {
        progress.clear(); saveProgress(progress); renderLessons(); updateProgressUI("本地学习进度已重置");
      }
    }
    const viewButton = target.closest<HTMLButtonElement>("[data-view]"); if (viewButton) { state.view = viewButton.dataset.view as "grid" | "list"; document.querySelectorAll<HTMLButtonElement>("[data-view]").forEach((button) => button.setAttribute("aria-pressed", String(button === viewButton))); renderLessons(); }
  });

  document.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-filter]").forEach((control) => {
    const eventName = control instanceof HTMLInputElement ? "input" : "change";
    control.addEventListener(eventName, () => { state.filters[control.dataset.filter as keyof Filters] = control.value; renderLessons(); });
  });
  const dialog = document.querySelector<HTMLDialogElement>("[data-lesson-dialog]")!;
  dialog.addEventListener("click", (event) => { if (event.target === dialog) closeDialog(); });
  dialog.addEventListener("cancel", (event) => { event.preventDefault(); closeDialog(); });
  window.addEventListener("hashchange", restoreHash);

  const sections = [...document.querySelectorAll<HTMLElement>("main section[id]")];
  const links = [...nav.querySelectorAll<HTMLAnchorElement>("a")];
  const observer = new IntersectionObserver((entries) => { const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]; if (visible) links.forEach((link) => link.classList.toggle("active", link.hash === `#${visible.target.id}`)); }, { rootMargin: "-20% 0px -65%", threshold: [0, .3] });
  sections.forEach((section) => observer.observe(section));
}

function restoreHash(): void {
  const match = location.hash.match(/^#lesson-(\d{2})$/);
  if (match) openLesson(`lesson-${match[1]}`);
}

async function startGalaxy(): Promise<void> {
  const host = document.querySelector<HTMLElement>("[data-galaxy-host]")!;
  const fallback = document.querySelector<HTMLElement>("[data-galaxy-fallback]")!;
  const status = document.querySelector<HTMLElement>("[data-galaxy-mode]")!;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const simplified = shouldUseSimplifiedGalaxy(innerWidth, reduced, (navigator as Navigator & { deviceMemory?: number }).deviceMemory);
  if (simplified) { host.classList.add("fallback-mode"); fallback.hidden = false; status.textContent = reduced ? "2D星图 · 已减少动态" : "2D星图 · 移动端优化"; return; }
  try {
    const { initGalaxy } = await import("./galaxy");
    fallback.hidden = true; status.textContent = "3D交互星图";
    galaxyController = initGalaxy({ host, modules: data.modules, lessons: data.lessons, completed: progress, onModule: selectModule, onLesson: (lesson) => openLesson(lesson.id) });
    galaxyController.setVisibleLessons(new Set(filterLessons(data.lessons, state.filters).map((lesson) => lesson.id)));
  } catch (error) {
    console.warn("3D课程星图不可用，已切换到2D完整体验。", error);
    host.classList.add("fallback-mode"); fallback.hidden = false; status.textContent = "2D课程星图";
  }
}

renderApp();
renderLessons();
bindEvents();
initLabs(data.featuredLabs);
restoreHash();
void startGalaxy();

const structuredData = document.createElement("script");
structuredData.type = "application/ld+json";
structuredData.textContent = JSON.stringify({ "@context": "https://schema.org", "@type": "Course", name: data.meta.courseTitle, description: data.meta.siteDescription, educationalLevel: "大学一年级", inLanguage: data.meta.language, numberOfCredits: data.meta.totalLessons });
document.head.append(structuredData);

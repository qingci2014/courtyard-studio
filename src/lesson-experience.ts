import "./lesson-experience.css";
import type { InvestigationCase, InvestigationVerdict, LessonExperience } from "./types";

interface CaseAnswer {
  initial?: InvestigationVerdict;
  final?: InvestigationVerdict;
  confidence: number;
  evidenceSeen: boolean;
  resolved: boolean;
}

interface InvestigationState {
  stage: "intro" | "case" | "report";
  estimate: number;
  caseIndex: number;
  answers: Record<string, CaseAnswer>;
  reflection: string;
  completed: boolean;
}

interface ExperienceOptions {
  root: HTMLElement;
  experience: LessonExperience;
  onClose: () => void;
  onComplete: () => void;
}

const verdictClass = (verdict?: InvestigationVerdict) => verdict ? `is-${verdict}` : "";
const escapeHtml = (value: string) => value.replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]!);

function freshState(): InvestigationState {
  return { stage: "intro", estimate: 3, caseIndex: 0, answers: {}, reflection: "", completed: false };
}

function loadState(key: string, experience: LessonExperience): InvestigationState {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? "null") as Partial<InvestigationState> | null;
    if (!parsed || !["intro", "case", "report"].includes(parsed.stage ?? "")) return freshState();
    return {
      ...freshState(),
      ...parsed,
      estimate: Math.min(experience.cases.length, Math.max(0, Number(parsed.estimate) || 0)),
      caseIndex: Math.min(experience.cases.length - 1, Math.max(0, Number(parsed.caseIndex) || 0)),
      answers: parsed.answers ?? {}
    };
  } catch {
    return freshState();
  }
}

function answerFor(state: InvestigationState, item: InvestigationCase): CaseAnswer {
  return state.answers[item.id] ?? { confidence: 70, evidenceSeen: false, resolved: false };
}

function scoreState(state: InvestigationState, experience: LessonExperience) {
  const answered = experience.cases.map((item) => ({ item, answer: answerFor(state, item) })).filter(({ answer }) => answer.resolved);
  const correct = answered.filter(({ item, answer }) => answer.final === item.verdict).length;
  const revisions = answered.filter(({ answer }) => answer.initial !== answer.final).length;
  const calibrated = answered.filter(({ item, answer }) => {
    const initiallyCorrect = answer.initial === item.verdict;
    return initiallyCorrect ? answer.confidence >= 70 : answer.confidence <= 70;
  }).length;
  const credibility = Math.round((correct / experience.cases.length) * 70 + (calibrated / experience.cases.length) * 30);
  return { correct, revisions, calibrated, credibility };
}

function choiceButtons(experience: LessonExperience, selected?: InvestigationVerdict, mode = "initial"): string {
  return (Object.entries(experience.labels) as [InvestigationVerdict, string][]).map(([value, label]) => `
    <button class="investigation-choice ${verdictClass(value)}" data-${mode}-verdict="${value}" aria-pressed="${selected === value}">
      <span>${value === "ai" ? "◉" : value === "automation" ? "⌘" : "?"}</span><strong>${label}</strong>
    </button>`).join("");
}

function mechanismMarkup(item: InvestigationCase): string {
  const entries: [string, string][] = [
    ["任务", item.mechanism.task], ["输入", item.mechanism.input], ["处理", item.mechanism.operation],
    ["输出", item.mechanism.output], ["人的位置", item.mechanism.humanImpact]
  ];
  return `<div class="mechanism-flow">${entries.map(([label, value], index) => `<article><span>${String(index + 1).padStart(2, "0")} · ${label}</span><p>${escapeHtml(value)}</p></article>`).join("")}</div>`;
}

function renderIntro(experience: LessonExperience, state: InvestigationState): string {
  const hasProgress = Object.values(state.answers).some((answer) => answer.evidenceSeen);
  return `<main class="investigation-intro" aria-labelledby="investigation-title">
    <section class="investigation-briefing">
      <p class="investigation-eyebrow">${experience.intro.eyebrow}</p>
      <h1 id="investigation-title" data-view-title tabindex="-1">${experience.intro.title}</h1>
      <p class="investigation-question">${experience.intro.question}</p>
      <p>${experience.intro.briefing}</p>
      <div class="estimate-control">
        <label for="ai-estimate">${experience.intro.estimateLabel}</label>
        <div><input id="ai-estimate" data-estimate type="range" min="0" max="${experience.cases.length}" value="${state.estimate}"><output data-estimate-output>${state.estimate} / ${experience.cases.length}</output></div>
      </div>
      <button class="investigation-primary" data-begin-investigation>${hasProgress ? "继续上次调查" : "接受案件，开始调查"}<span>→</span></button>
      <small>约${experience.durationMinutes}分钟 · 全程本地运行 · 可以随时退出继续</small>
    </section>
    <aside class="investigation-phone" aria-hidden="true">
      <div class="phone-speaker"></div><span>07:08</span>
      <div class="phone-alert"><i></i><div><small>调查局 · 刚刚</small><strong>你的数字生活留下了6处可疑痕迹</strong><p>其中有些是AI，有些只是在自动运行。</p></div></div>
      <div class="phone-scan"><b></b><span>TRACE / 01</span></div>
    </aside>
  </main>`;
}

function renderCase(experience: LessonExperience, state: InvestigationState): string {
  const item = experience.cases[state.caseIndex]!;
  const answer = answerFor(state, item);
  const progress = ((state.caseIndex + (answer.resolved ? 1 : 0)) / experience.cases.length) * 100;
  return `<main class="investigation-case" aria-labelledby="case-title">
    <div class="case-progress" aria-label="调查进度"><span style="width:${progress}%"></span></div>
    <div class="case-layout">
      <section class="case-scene">
        <div class="case-time"><span>${item.time}</span><small>${item.scene}</small></div>
        <p>现场 ${String(state.caseIndex + 1).padStart(2, "0")} / ${String(experience.cases.length).padStart(2, "0")}</p>
        <h1 id="case-title" data-view-title tabindex="-1">${item.title}</h1>
        <p class="case-description">${item.description}</p>
        <div class="scene-visual ${verdictClass(answer.final)}" aria-hidden="true"><span>${item.time}</span><i></i><b>${item.scene}</b><small>SCANNING DIGITAL TRACE</small></div>
      </section>
      <section class="case-workbench" aria-live="polite">
        ${!answer.evidenceSeen ? `<p class="workbench-label">你的初步判断</p>
          <h2>这个现场属于哪一种情况？</h2>
          <div class="investigation-choices">${choiceButtons(experience, answer.initial)}</div>
          <fieldset class="confidence-picker"><legend>你对这个判断有多大把握？</legend><div>${experience.confidenceLevels.map((level) => `<button data-confidence="${level}" aria-pressed="${answer.confidence === level}">${level}%</button>`).join("")}</div></fieldset>
          <button class="investigation-primary" data-reveal-evidence ${answer.initial ? "" : "disabled"}>提交判断，打开证据袋 <span>↓</span></button>` : `
          <div class="evidence-heading"><p class="workbench-label">技术证据 E-${String(state.caseIndex + 1).padStart(2, "0")}</p><span>初判：${experience.labels[answer.initial!] ?? "未判断"} · 信心${answer.confidence}%</span></div>
          <blockquote>${item.clue}</blockquote>
          ${mechanismMarkup(item)}
          ${!answer.resolved ? `<div class="final-verdict"><p class="workbench-label">看完证据后的最终结论</p><h2>你要坚持，还是改判？</h2><div class="investigation-choices">${choiceButtons(experience, answer.final, "final")}</div><button class="investigation-primary" data-lock-verdict>锁定结论 <span>→</span></button></div>` : `
            <div class="case-resolution ${answer.final === item.verdict ? "is-correct" : "is-missed"}">
              <span>${answer.final === item.verdict ? "证据链成立" : "需要重新校准"}</span>
              <h2>结论：${experience.labels[item.verdict]}</h2>
              <p>${item.explanation}</p>
              <div><b>对应知识点</b><strong>${item.concept}</strong></div>
            </div>
            <button class="investigation-primary" data-next-case>${state.caseIndex === experience.cases.length - 1 ? "生成我的AI关系图" : "进入下一个现场"} <span>→</span></button>`}
        `}
      </section>
    </div>
  </main>`;
}

function renderReport(experience: LessonExperience, state: InvestigationState): string {
  const score = scoreState(state, experience);
  const positions = [[15, 22], [50, 9], [84, 24], [16, 74], [50, 89], [84, 72]];
  const lines = positions.map(([x, y]) => `<line x1="50" y1="50" x2="${x}" y2="${y}" />`).join("");
  const nodes = experience.cases.map((item, index) => {
    const answer = answerFor(state, item); const [x, y] = positions[index]!;
    return `<article class="footprint-node ${verdictClass(answer.final)} ${answer.final === item.verdict ? "is-correct" : "is-missed"}" style="--x:${x}%;--y:${y}%"><span>${item.time}</span><strong>${item.title}</strong><small>${experience.labels[answer.final ?? "uncertain"]} · ${item.concept}</small></article>`;
  }).join("");
  return `<main class="investigation-report" aria-labelledby="report-title">
    <section class="report-heading">
      <p class="investigation-eyebrow">INVESTIGATION COMPLETE · LESSON 01</p>
      <h1 id="report-title" data-view-title tabindex="-1">${experience.report.title}</h1>
      <p>你的结论不是由“看起来是否聪明”决定，而是由任务、数据、处理机制和证据共同支持。</p>
    </section>
    <section class="credibility-panel" aria-label="调查结果">
      <div class="credibility-score"><span>调查可信度</span><strong>${score.credibility}</strong><small>/ 100</small></div>
      <dl><div><dt>${score.correct} / ${experience.cases.length}</dt><dd>证据辨识</dd></div><div><dt>${score.calibrated} / ${experience.cases.length}</dt><dd>信心校准</dd></div><div><dt>${score.revisions}</dt><dd>依据证据改判</dd></div></dl>
    </section>
    <section class="footprint-section"><div class="footprint-map"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${lines}</svg><div class="footprint-person"><span>我</span><small>选择与责任</small></div>${nodes}</div></section>
    <section class="report-reflection">
      <div><p class="workbench-label">最后陈述</p><h2>${experience.report.reflectionPrompt}</h2><p>${experience.report.closingQuestion}</p></div>
      <label><span class="sr-only">调查反思</span><textarea data-reflection placeholder="${escapeHtml(experience.report.reflectionPlaceholder)}">${escapeHtml(state.reflection)}</textarea></label>
    </section>
    <div class="report-actions"><button class="investigation-secondary" data-reset-investigation>重新调查</button><button class="investigation-primary" data-complete-investigation>${state.completed ? "✓ 已存入课程进度" : "完成第一课并保存关系图"}<span>→</span></button></div>
  </main>`;
}

export function initLessonExperience({ root, experience, onClose, onComplete }: ExperienceOptions) {
  const storageKey = `ai-course-${experience.slug}-v1`;
  let state = loadState(storageKey, experience);

  const save = () => localStorage.setItem(storageKey, JSON.stringify(state));
  const render = (focusSelector = "[data-view-title]") => {
    root.innerHTML = `<div class="investigation-app">
      <header class="investigation-header"><button data-close-investigation aria-label="退出调查，返回课程">← <span>返回课程</span></button><a href="#lesson-01" data-close-investigation><strong>AI /</strong> TRACE LAB</a><div><span>${state.stage === "intro" ? "任务简报" : state.stage === "case" ? `现场 ${state.caseIndex + 1}/${experience.cases.length}` : "调查报告"}</span><button data-reset-investigation>重置</button></div></header>
      ${state.stage === "intro" ? renderIntro(experience, state) : state.stage === "case" ? renderCase(experience, state) : renderReport(experience, state)}
    </div>`;
    requestAnimationFrame(() => root.querySelector<HTMLElement>(focusSelector)?.focus());
  };

  const reset = () => { state = freshState(); localStorage.removeItem(storageKey); render(); };

  root.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    if (target.closest("[data-close-investigation]")) { event.preventDefault(); onClose(); return; }
    if (target.closest("[data-reset-investigation]")) { if (window.confirm("确定清除第一课的调查记录并重新开始吗？")) reset(); return; }
    if (target.closest("[data-begin-investigation]")) { state.stage = "case"; save(); render(); return; }
    const item = experience.cases[state.caseIndex]; if (!item) return;
    const answer = answerFor(state, item); state.answers[item.id] = answer;
    const initial = target.closest<HTMLButtonElement>("[data-initial-verdict]");
    if (initial) { answer.initial = initial.dataset.initialVerdict as InvestigationVerdict; answer.final = answer.initial; save(); render(`[data-initial-verdict="${answer.initial}"]`); return; }
    const confidence = target.closest<HTMLButtonElement>("[data-confidence]");
    if (confidence) { answer.confidence = Number(confidence.dataset.confidence); save(); render(`[data-confidence="${answer.confidence}"]`); return; }
    if (target.closest("[data-reveal-evidence]") && answer.initial) { answer.evidenceSeen = true; save(); render("[data-lock-verdict]"); return; }
    const final = target.closest<HTMLButtonElement>("[data-final-verdict]");
    if (final) { answer.final = final.dataset.finalVerdict as InvestigationVerdict; save(); render(`[data-final-verdict="${answer.final}"]`); return; }
    if (target.closest("[data-lock-verdict]") && answer.final) { answer.resolved = true; save(); render("[data-next-case]"); return; }
    if (target.closest("[data-next-case]")) {
      if (state.caseIndex < experience.cases.length - 1) state.caseIndex += 1;
      else state.stage = "report";
      save(); render(); return;
    }
    if (target.closest("[data-complete-investigation]")) { state.completed = true; save(); onComplete(); render("[data-complete-investigation]"); }
  });

  root.addEventListener("input", (event) => {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement;
    if (target.matches("[data-estimate]")) {
      state.estimate = Number(target.value); root.querySelector<HTMLOutputElement>("[data-estimate-output]")!.value = `${state.estimate} / ${experience.cases.length}`; save();
    }
    if (target.matches("[data-reflection]")) { state.reflection = target.value; save(); }
  });

  render();
  return { reset };
}

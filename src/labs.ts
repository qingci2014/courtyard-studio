import type { FeaturedLab } from "./types";
import { calculateMetrics, temperatureDistribution } from "./utils";

const tasks = [
  { id: "tax", title: "按固定税率计算税额", answer: "规则程序", explanation: "规则明确、结果可复现，程序最合适。" },
  { id: "spam", title: "识别垃圾邮件", answer: "机器学习", explanation: "需从大量带标签样本中归纳模式，并持续评估误报。" },
  { id: "poster", title: "为社团生成海报草案", answer: "生成式AI", explanation: "开放式创意可由生成模型起草，但版权与最终选择仍由人负责。" },
  { id: "appeal", title: "决定学生申诉是否成立", answer: "人类决策", explanation: "涉及权利、情境与责任，AI只能辅助整理证据。" }
];
const routes = ["规则程序", "机器学习", "生成式AI", "人类决策"];

export function initParadigmLab(root: HTMLElement): void {
  const selections = new Map<string, string>();
  let activeTask = tasks[0]!.id;
  root.innerHTML = `
    <div class="lab-instructions"><strong>操作：</strong>先选择任务，再选择技术路线；也可拖拽任务卡。</div>
    <div class="sorter-layout">
      <div class="task-deck" aria-label="待分类任务">${tasks.map((task) => `<button class="task-card" draggable="true" data-task="${task.id}" aria-pressed="false">${task.title}</button>`).join("")}</div>
      <div class="route-grid">${routes.map((route) => `<button class="route-zone" data-route="${route}"><span>${route}</span><small>将所选任务放到这里</small></button>`).join("")}</div>
    </div>
    <button class="button secondary" data-check-sorter>检查并解释</button>
    <div class="lab-result" data-sorter-result aria-live="polite"></div>`;
  const taskButtons = [...root.querySelectorAll<HTMLButtonElement>("[data-task]")];
  const selectTask = (button: HTMLButtonElement) => {
    activeTask = button.dataset.task!;
    taskButtons.forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
  };
  taskButtons.forEach((button) => {
    button.addEventListener("click", () => selectTask(button));
    button.addEventListener("dragstart", (event) => event.dataTransfer?.setData("text/plain", button.dataset.task!));
  });
  selectTask(taskButtons[0]!);
  root.querySelectorAll<HTMLButtonElement>("[data-route]").forEach((zone) => {
    zone.addEventListener("dragover", (event) => event.preventDefault());
    const assign = (taskId: string) => {
      selections.set(taskId, zone.dataset.route!);
      const task = tasks.find((item) => item.id === taskId)!;
      root.querySelector<HTMLButtonElement>(`[data-task="${taskId}"]`)!.innerHTML = `${task.title}<small>已选：${zone.dataset.route}</small>`;
    };
    zone.addEventListener("drop", (event) => { event.preventDefault(); assign(event.dataTransfer?.getData("text/plain") || activeTask); });
    zone.addEventListener("click", () => assign(activeTask));
  });
  root.querySelector("[data-check-sorter]")!.addEventListener("click", () => {
    const correct = tasks.filter((task) => selections.get(task.id) === task.answer).length;
    root.querySelector<HTMLElement>("[data-sorter-result]")!.innerHTML = `<strong>${correct} / ${tasks.length} 个主要路线匹配。</strong><ul>${tasks.map((task) => `<li><b>${task.title}</b>：推荐 ${task.answer}。${task.explanation}</li>`).join("")}</ul><p>真实系统常是组合方案；关键是明确人工监督、证据与回退。</p>`;
  });
}

const screening = [
  { score: .96, positive: true }, { score: .91, positive: true }, { score: .84, positive: false }, { score: .78, positive: true },
  { score: .69, positive: false }, { score: .62, positive: true }, { score: .55, positive: false }, { score: .43, positive: true },
  { score: .37, positive: false }, { score: .29, positive: false }, { score: .18, positive: false }, { score: .08, positive: false }
];
const spam = screening.map((sample, index) => ({ score: Math.min(.99, sample.score + (index % 3 - 1) * .08), positive: index % 4 !== 0 }));

export function initMetricsLab(root: HTMLElement): void {
  root.innerHTML = `<div class="lab-toolbar"><label>场景 <select data-scenario><option value="screening">疾病筛查</option><option value="spam">垃圾邮件</option></select></label><label>决策阈值 <output data-threshold>.50</output><input data-metric-range aria-label="决策阈值，0到1" type="range" min="0" max="1" step="0.01" value="0.5"></label></div><div class="metric-grid" data-metrics></div><p class="chart-summary" data-metric-summary></p>`;
  const range = root.querySelector<HTMLInputElement>("[data-metric-range]")!;
  const scenario = root.querySelector<HTMLSelectElement>("[data-scenario]")!;
  const update = () => {
    const threshold = Number(range.value);
    const metrics = calculateMetrics(scenario.value === "screening" ? screening : spam, threshold);
    root.querySelector<HTMLOutputElement>("[data-threshold]")!.value = threshold.toFixed(2);
    root.querySelector<HTMLElement>("[data-metrics]")!.innerHTML = [
      ["TP 真阳性", metrics.tp], ["FP 假阳性", metrics.fp], ["TN 真阴性", metrics.tn], ["FN 假阴性", metrics.fn],
      ["准确率", `${Math.round(metrics.accuracy * 100)}%`], ["精确率", `${Math.round(metrics.precision * 100)}%`], ["召回率", `${Math.round(metrics.recall * 100)}%`]
    ].map(([label, value]) => `<div><small>${label}</small><strong>${value}</strong></div>`).join("");
    root.querySelector<HTMLElement>("[data-metric-summary]")!.textContent = scenario.value === "screening" ? "筛查通常更重视召回率：宁可增加复查，也要尽量少漏掉患者。" : "垃圾邮件过滤更重视精确率：误删正常邮件的代价很高。";
  };
  range.addEventListener("input", update); scenario.addEventListener("change", update); update();
}

const tokenCandidates = ["知识", "工具", "伙伴", "答案", "挑战", "镜子"];
const tokenLogits = [2.8, 2.35, 2.1, 1.55, 1.25, .9];
export function initTokenLab(root: HTMLElement): void {
  let seed = 17;
  let sentence = "对大学生来说，人工智能首先是一种";
  root.innerHTML = `<div class="token-sentence" data-sentence>${sentence}<span>▌</span></div><label>温度 <output data-temperature>1.0</output><input data-token-range aria-label="生成温度，0.2到2" type="range" min="0.2" max="2" step="0.1" value="1"></label><div class="token-bars" data-token-bars></div><div class="lab-actions"><button class="button secondary" data-generate>生成一步</button><label class="check"><input type="checkbox" data-fixed checked> 固定随机种子</label></div><p class="chart-summary">这是原理模拟，不是真实模型推理。温度越低，分布越集中；越高，候选更平均。</p>`;
  const range = root.querySelector<HTMLInputElement>("[data-token-range]")!;
  const fixed = root.querySelector<HTMLInputElement>("[data-fixed]")!;
  let probabilities = temperatureDistribution(tokenLogits, 1);
  const render = () => {
    const temperature = Number(range.value);
    probabilities = temperatureDistribution(tokenLogits, temperature);
    root.querySelector<HTMLOutputElement>("[data-temperature]")!.value = temperature.toFixed(1);
    root.querySelector<HTMLElement>("[data-token-bars]")!.innerHTML = tokenCandidates.map((token, index) => `<button data-token-index="${index}" style="--prob:${probabilities[index]}"><span>${token}</span><i></i><b>${Math.round((probabilities[index] ?? 0) * 100)}%</b></button>`).join("");
  };
  const choose = (index: number) => {
    sentence += tokenCandidates[index];
    root.querySelector<HTMLElement>("[data-sentence]")!.innerHTML = `${sentence}<span>▌</span>`;
  };
  range.addEventListener("input", render);
  root.querySelector("[data-token-bars]")!.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-token-index]");
    if (button) choose(Number(button.dataset.tokenIndex));
  });
  root.querySelector("[data-generate]")!.addEventListener("click", () => {
    seed = fixed.checked ? (seed * 9301 + 49297) % 233280 : Math.floor(Math.random() * 233280);
    let value = seed / 233280;
    let index = probabilities.length - 1;
    probabilities.some((probability, candidateIndex) => { value -= probability; if (value <= 0) { index = candidateIndex; return true; } return false; });
    choose(index);
  });
  render();
}

const promptFields: ReadonlyArray<readonly [string, string, string]> = [
  ["goal", "目标", "例如：比较两种校园节能方案"], ["audience", "背景与受众", "课程、读者与已有知识"],
  ["input", "输入材料", "列出可使用的材料与来源"], ["constraints", "约束", "字数、范围、不可做事项"],
  ["example", "示例", "给出期望风格或结构示例"], ["format", "输出格式", "表格、提纲或分段说明"],
  ["criteria", "评价标准", "准确、可执行、有证据……"], ["verify", "核验要求", "标注来源、不确定性与待核实项"]
];
export function initPromptLab(root: HTMLElement): void {
  root.innerHTML = `<div class="prompt-layout"><form data-prompt-form>${promptFields.map(([id, label, placeholder]) => `<label>${label}<textarea name="${id}" rows="2" placeholder="${placeholder}"></textarea></label>`).join("")}</form><div class="prompt-output"><div class="completeness"><span>完整度</span><strong data-completeness>0%</strong></div><pre data-prompt-template>填写左侧字段后，这里会实时生成结构化提示。</pre><button class="button secondary" type="button" data-copy-prompt>复制提示</button><p data-copy-status aria-live="polite"></p></div></div>`;
  const form = root.querySelector<HTMLFormElement>("[data-prompt-form]")!;
  const update = () => {
    const values = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
    const filled = promptFields.filter(([id]) => values[id]?.trim()).length;
    const template = promptFields.filter(([id]) => values[id]?.trim()).map(([id, label]) => `【${label}】\n${values[id]!.trim()}`).join("\n\n");
    root.querySelector<HTMLElement>("[data-completeness]")!.textContent = `${Math.round(filled / promptFields.length * 100)}%`;
    root.querySelector<HTMLElement>("[data-prompt-template]")!.textContent = template || "填写左侧字段后，这里会实时生成结构化提示。";
  };
  form.addEventListener("input", update);
  root.querySelector<HTMLButtonElement>("[data-copy-prompt]")!.addEventListener("click", async () => {
    const text = root.querySelector<HTMLElement>("[data-prompt-template]")!.textContent ?? "";
    try { await navigator.clipboard.writeText(text); root.querySelector<HTMLElement>("[data-copy-status]")!.textContent = "已复制到剪贴板。"; }
    catch { root.querySelector<HTMLElement>("[data-copy-status]")!.textContent = "无法自动复制，请手动选择文本。"; }
  });
}

export function initLabs(labs: FeaturedLab[]): void {
  const initializers = [initParadigmLab, initMetricsLab, initTokenLab, initPromptLab];
  labs.forEach((lab, index) => {
    const root = document.querySelector<HTMLElement>(`[data-lab-root="${lab.id}"]`);
    if (root) initializers[index]?.(root);
  });
}

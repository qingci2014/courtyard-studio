import type { CourseData, Filters, Lesson } from "./types";

export const PROGRESS_KEY = "ai-general-course-progress-v1";

export function validateCourse(data: CourseData): string[] {
  const errors: string[] = [];
  const ids = new Set(data.lessons.map((lesson) => lesson.id));
  const moduleIds = new Set(data.modules.map((module) => module.id));
  const dimensions = new Set(data.competencyFramework.dimensions.map((item) => item.id));
  const levels = new Set(data.competencyFramework.levels.map((item) => item.id));
  if (data.lessons.length !== 32) errors.push("课程必须恰好包含32课时");
  if (ids.size !== data.lessons.length) errors.push("课时ID必须唯一");
  if (data.modules.length !== 8) errors.push("课程必须包含8个模块");
  const maxConcepts = Math.max(...data.lessons.map((lesson) => lesson.concepts.length));
  if (data.studyScaffolds.conceptPrompts.length < maxConcepts) errors.push("知识点学习提示数量不足");
  if (!data.studyScaffolds.selfCheckInstruction.trim()) errors.push("即时自测说明不能为空");
  data.lessons.forEach((lesson, index) => {
    if (lesson.number !== index + 1) errors.push(`课时编号不连续：${lesson.id}`);
    if (!moduleIds.has(lesson.moduleId)) errors.push(`无效模块：${lesson.id}`);
    if (!dimensions.has(lesson.competencyDimension)) errors.push(`无效能力维度：${lesson.id}`);
    if (!levels.has(lesson.progressionLevel)) errors.push(`无效递进层级：${lesson.id}`);
    if (!lesson.concepts.length) errors.push(`课时缺少核心知识点：${lesson.id}`);
  });
  for (let week = 1; week <= 16; week += 1) {
    if (data.lessons.filter((lesson) => lesson.week === week).length !== 2) errors.push(`第${week}周不是2课时`);
  }
  if (data.assessment.reduce((sum, item) => sum + item.weight, 0) !== 100) errors.push("总评权重必须合计100%");
  return errors;
}

export function loadProgress(validLessons: Lesson[], storage: Pick<Storage, "getItem"> = localStorage): Set<string> {
  const validIds = new Set(validLessons.map((lesson) => lesson.id));
  try {
    const parsed: unknown = JSON.parse(storage.getItem(PROGRESS_KEY) ?? "[]");
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string" && validIds.has(id)) : []);
  } catch { return new Set(); }
}

export function saveProgress(progress: Set<string>, storage: Pick<Storage, "setItem"> = localStorage): void {
  storage.setItem(PROGRESS_KEY, JSON.stringify([...progress]));
}

export function filterLessons(lessons: Lesson[], filters: Filters): Lesson[] {
  const query = filters.query.trim().toLocaleLowerCase("zh-CN");
  return lessons.filter((lesson) => {
    const haystack = [lesson.title, lesson.drivingQuestion, lesson.inClassActivity, lesson.learningArtifact, ...lesson.concepts].join(" ").toLocaleLowerCase("zh-CN");
    return (!query || haystack.includes(query))
      && (!filters.module || lesson.moduleId === filters.module)
      && (!filters.competency || lesson.competencyDimension === filters.competency)
      && (!filters.level || lesson.progressionLevel === filters.level);
  });
}

export interface Metrics { tp: number; fp: number; tn: number; fn: number; accuracy: number; precision: number; recall: number }
export function calculateMetrics(samples: Array<{ score: number; positive: boolean }>, threshold: number): Metrics {
  let tp = 0; let fp = 0; let tn = 0; let fn = 0;
  samples.forEach((sample) => {
    const predicted = sample.score >= threshold;
    if (predicted && sample.positive) tp += 1;
    else if (predicted) fp += 1;
    else if (sample.positive) fn += 1;
    else tn += 1;
  });
  const safe = (value: number, total: number) => total ? value / total : 0;
  return { tp, fp, tn, fn, accuracy: safe(tp + tn, samples.length), precision: safe(tp, tp + fp), recall: safe(tp, tp + fn) };
}

export function temperatureDistribution(logits: number[], temperature: number): number[] {
  const safeTemperature = Math.max(0.1, temperature);
  const scaled = logits.map((value) => value / safeTemperature);
  const max = Math.max(...scaled);
  const exps = scaled.map((value) => Math.exp(value - max));
  const total = exps.reduce((sum, value) => sum + value, 0);
  return exps.map((value) => value / total);
}

export const lessonHash = (lesson: Lesson) => `#lesson-${String(lesson.number).padStart(2, "0")}`;

export function shouldUseSimplifiedGalaxy(width: number, reducedMotion: boolean, deviceMemory?: number): boolean {
  return width < 768 || reducedMotion || deviceMemory === 1;
}

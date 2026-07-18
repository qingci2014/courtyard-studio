import { describe, expect, it } from "vitest";
import rawData from "../data/course-data.json";
import type { CourseData } from "../types";
import { calculateMetrics, filterLessons, loadProgress, PROGRESS_KEY, shouldUseSimplifiedGalaxy, temperatureDistribution } from "../utils";

const data = rawData as CourseData;

describe("筛选与本地进度", () => {
  it("可按关键词、模块、能力和层级组合筛选", () => {
    const result = filterLessons(data.lessons, { query: "证据", module: "m6", competency: "human-centered", level: "apply" });
    expect(result.map((lesson) => lesson.number)).toEqual([24]);
  });

  it("读取进度时忽略不存在的课时和损坏数据", () => {
    const storage = { getItem: (key: string) => key === PROGRESS_KEY ? JSON.stringify(["lesson-01", "lesson-99", 3]) : null };
    expect([...loadProgress(data.lessons, storage)]).toEqual(["lesson-01"]);
    expect([...loadProgress(data.lessons, { getItem: () => "{" })]).toEqual([]);
  });
});

describe("互动实验计算", () => {
  it("阈值实验正确计算混淆矩阵和指标", () => {
    const metrics = calculateMetrics([{ score: .9, positive: true }, { score: .8, positive: false }, { score: .4, positive: true }, { score: .2, positive: false }], .5);
    expect(metrics).toMatchObject({ tp: 1, fp: 1, tn: 1, fn: 1, accuracy: .5, precision: .5, recall: .5 });
  });

  it("Token温度分布归一化，低温更集中", () => {
    const low = temperatureDistribution([3, 2, 1], .2);
    const high = temperatureDistribution([3, 2, 1], 2);
    expect(low.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1);
    expect(high.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1);
    expect(low[0]).toBeGreaterThan(high[0]!);
  });
});

describe("星图降级策略", () => {
  it("移动端、减少动态和低内存设备使用2D完整体验", () => {
    expect(shouldUseSimplifiedGalaxy(767, false, 8)).toBe(true);
    expect(shouldUseSimplifiedGalaxy(1440, true, 8)).toBe(true);
    expect(shouldUseSimplifiedGalaxy(1440, false, 1)).toBe(true);
    expect(shouldUseSimplifiedGalaxy(1440, false, 8)).toBe(false);
  });
});

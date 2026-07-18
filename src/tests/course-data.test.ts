import { describe, expect, it } from "vitest";
import rawData from "../data/course-data.json";
import type { CourseData } from "../types";
import { validateCourse } from "../utils";

const data = rawData as CourseData;

describe("课程唯一数据源", () => {
  it("通过全部结构与完整性校验", () => {
    expect(validateCourse(data)).toEqual([]);
  });

  it("包含32个唯一且连续的课时", () => {
    expect(data.lessons).toHaveLength(32);
    expect(new Set(data.lessons.map((lesson) => lesson.id)).size).toBe(32);
    expect(data.lessons.map((lesson) => lesson.number)).toEqual(Array.from({ length: 32 }, (_, index) => index + 1));
  });

  it("每周两课，八个模块都有课时", () => {
    expect(Array.from({ length: 16 }, (_, index) => data.lessons.filter((lesson) => lesson.week === index + 1).length)).toEqual(Array(16).fill(2));
    expect(new Set(data.lessons.map((lesson) => lesson.moduleId))).toEqual(new Set(data.modules.map((module) => module.id)));
  });

  it("总评权重合计100%", () => {
    expect(data.assessment.reduce((sum, item) => sum + item.weight, 0)).toBe(100);
  });

  it("每课知识点均可由JSON中的学习脚手架完整呈现", () => {
    expect(data.lessons.every((lesson) => lesson.concepts.length >= 3)).toBe(true);
    expect(data.studyScaffolds.conceptPrompts.length).toBeGreaterThanOrEqual(Math.max(...data.lessons.map((lesson) => lesson.concepts.length)));
    expect(data.studyScaffolds.selfCheckInstruction.length).toBeGreaterThan(10);
  });

  it("第一课互动调查的案件、证据与结论均来自JSON", () => {
    const experience = data.lessonExperiences.find((item) => item.lessonId === "lesson-01");
    expect(experience).toBeDefined();
    expect(experience?.cases).toHaveLength(6);
    expect(new Set(experience?.cases.map((item) => item.verdict))).toEqual(new Set(["ai", "automation", "uncertain"]));
    expect(experience?.cases.every((item) => item.clue && item.explanation && item.mechanism.humanImpact)).toBe(true);
  });
});

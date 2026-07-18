export type CompetencyDimension = "human-centered" | "ethics" | "techniques" | "system-design";
export type ProgressionLevel = "understand" | "apply" | "create";

export interface CourseMeta {
  courseTitle: string;
  courseSubtitle: string;
  audience: string;
  totalLessons: number;
  lessonDurationMinutes: number;
  semesterWeeks: number;
  lessonsPerWeek: number;
  language: string;
  deliveryMode: string;
  siteTagline: string;
  siteDescription: string;
}

export interface FrameworkItem { id: string; label: string; description?: string }
export interface Module {
  id: string; order: number; title: string; subtitle: string; shortTitle: string; color: string;
  competencyFocus: CompetencyDimension[]; lessonRange: [number, number]; description: string;
}
export interface Lesson {
  id: string; number: number; week: number; periodInWeek: 1 | 2; durationMinutes: number;
  moduleId: string; title: string; drivingQuestion: string; concepts: string[];
  inClassActivity: string; learningArtifact: string; competencyDimension: CompetencyDimension;
  competencyDimensionLabel: string; progressionLevel: ProgressionLevel; progressionLevelLabel: string;
  visualKey: string; featuredInteractive: boolean;
}
export interface Assessment { name: string; weight: number; description: string }
export interface RubricItem { criterion: string; weight: number }
export interface FeaturedLab { id: string; title: string; lessonId: string; description: string; implementation: string }
export interface CourseData {
  meta: CourseMeta;
  competencyFramework: { dimensions: FrameworkItem[]; levels: FrameworkItem[] };
  learningOutcomes: string[];
  modules: Module[];
  lessons: Lesson[];
  assessment: Assessment[];
  finalProjectRubric: RubricItem[];
  featuredLabs: FeaturedLab[];
}

export interface Filters { query: string; module: string; competency: string; level: string }

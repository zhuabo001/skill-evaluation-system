export const PACKAGE_NAME = "@skill-studio/schemas";

export const SCHEMA_VERSION = 1;

export const SKILL_PROJECT_STATUSES = ["draft", "active", "archived"] as const;
export type SkillProjectStatus = (typeof SKILL_PROJECT_STATUSES)[number];

export const RUN_CONFIGURATIONS = ["with_skill", "baseline"] as const;
export type RunConfigurationMode = (typeof RUN_CONFIGURATIONS)[number];

export const ITERATION_STATUSES = [
  "planned",
  "running",
  "completed",
  "failed",
] as const;
export type IterationStatus = (typeof ITERATION_STATUSES)[number];

export const GRADING_STATUSES = ["pending", "graded", "failed"] as const;
export type GradingStatus = (typeof GRADING_STATUSES)[number];

export const BENCHMARK_STATUSES = ["pending", "completed"] as const;
export type BenchmarkStatus = (typeof BENCHMARK_STATUSES)[number];

export const BASELINE_TYPES = ["no_skill", "previous_iteration", "snapshot"] as const;
export type BaselineType = (typeof BASELINE_TYPES)[number];

export const KEBAB_CASE_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const EVAL_ID_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

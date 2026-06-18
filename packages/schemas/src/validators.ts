import { z } from "zod";

import {
  BASELINE_TYPES,
  BENCHMARK_STATUSES,
  EVAL_ID_REGEX,
  GRADING_STATUSES,
  ITERATION_STATUSES,
  KEBAB_CASE_REGEX,
  RUN_CONFIGURATIONS,
  SCHEMA_VERSION,
  SKILL_PROJECT_STATUSES,
} from "./constants.js";

const schemaVersionLiteral = z.literal(SCHEMA_VERSION);

const nonEmptyString = z.string().min(1, "must be a non-empty string");

const kebabCaseId = nonEmptyString.regex(KEBAB_CASE_REGEX, "must be kebab-case (lowercase letters, digits, hyphens)");

const evalId = nonEmptyString.regex(EVAL_ID_REGEX, "must be kebab-case suitable for a directory name");

export const SkillProjectManifestSchema = z.object({
  schema_version: schemaVersionLiteral,
  id: kebabCaseId,
  name: nonEmptyString,
  description: nonEmptyString,
  status: z.enum(SKILL_PROJECT_STATUSES),
});

export const EvalCaseSchema = z.object({
  id: evalId,
  title: nonEmptyString,
  enabled: z.boolean(),
  prompt: nonEmptyString,
  expected_output: nonEmptyString,
  files: z.array(nonEmptyString).default([]),
  assertions: z.array(nonEmptyString).min(1, "assertions must contain at least one entry"),
  tags: z.array(nonEmptyString).default([]),
});

export const EvalSetSchema = z
  .object({
    schema_version: schemaVersionLiteral,
    skill_id: kebabCaseId,
    evals: z.array(EvalCaseSchema).min(1, "evals must contain at least one case"),
  })
  .superRefine((value, ctx) => {
    const seen = new Set<string>();
    for (const evalCase of value.evals) {
      if (seen.has(evalCase.id)) {
        ctx.addIssue({
          code: "custom",
          message: `duplicate eval id: ${evalCase.id}`,
          path: ["evals"],
        });
      }
      seen.add(evalCase.id);
    }
  });

export const IterationBaselineSchema = z.object({
  type: z.enum(BASELINE_TYPES),
  ref: nonEmptyString.optional(),
});

export const IterationMetadataSchema = z.object({
  schema_version: schemaVersionLiteral,
  iteration_id: nonEmptyString,
  created_at: nonEmptyString,
  skill_version_ref: nonEmptyString,
  baseline: IterationBaselineSchema,
  evals_run: z.array(nonEmptyString).default([]),
  status: z.enum(ITERATION_STATUSES),
});

export const EvalMetadataSchema = z.object({
  schema_version: schemaVersionLiteral,
  eval_id: evalId,
  eval_name: nonEmptyString,
  prompt: nonEmptyString,
  expected_output: nonEmptyString,
  files: z.array(nonEmptyString).default([]),
  assertions: z.array(nonEmptyString).min(1, "assertions must contain at least one entry"),
});

export const RunConfigurationSchema = z.object({
  skill_id: kebabCaseId,
  eval_id: evalId,
  mode: z.enum(RUN_CONFIGURATIONS),
  model: z
    .object({
      provider: z.enum(["anthropic", "openai"]),
      model: nonEmptyString,
      temperature: z.number().optional(),
      max_tokens: z.number().int().positive().optional(),
    })
    .optional(),
});

export const TranscriptEntrySchema = z.object({
  role: z.enum(["user", "assistant", "tool", "system"]),
  content: nonEmptyString,
  timestamp: nonEmptyString.optional(),
});

export const TranscriptSchema = z.object({
  schema_version: schemaVersionLiteral,
  run_id: nonEmptyString,
  entries: z.array(TranscriptEntrySchema).default([]),
});

export const MetricsSchema = z.object({
  schema_version: schemaVersionLiteral,
  run_id: nonEmptyString,
  tool_calls: z.number().int().min(0),
  errors: z.array(nonEmptyString).default([]),
  notes: z.string().default(""),
});

export const TimingSchema = z.object({
  schema_version: schemaVersionLiteral,
  run_id: nonEmptyString,
  started_at: nonEmptyString,
  ended_at: nonEmptyString,
  duration_ms: z.number().min(0),
});

export const GradingAssertionSchema = z.object({
  assertion: nonEmptyString,
  passed: z.boolean(),
  evidence: nonEmptyString,
});

export const GradingSchema = z.object({
  schema_version: schemaVersionLiteral,
  run_id: nonEmptyString,
  grade_status: z.enum(GRADING_STATUSES),
  assertions: z.array(GradingAssertionSchema).default([]),
  summary: z.string().default(""),
});

export const BenchmarkRunRefSchema = z.object({
  grading_path: nonEmptyString,
  pass_rate: z.number().min(0).max(1).nullable(),
});

export const BenchmarkEvalSchema = z.object({
  eval_id: evalId,
  with_skill: BenchmarkRunRefSchema.nullable(),
  baseline: BenchmarkRunRefSchema.nullable(),
});

export const BenchmarkSchema = z.object({
  schema_version: schemaVersionLiteral,
  iteration_id: nonEmptyString,
  generated_at: nonEmptyString,
  status: z.enum(BENCHMARK_STATUSES),
  evals: z.array(BenchmarkEvalSchema).default([]),
  notes: z.string().default(""),
});

export const FeedbackEntrySchema = z.object({
  eval_id: evalId,
  configuration: z.enum(RUN_CONFIGURATIONS),
  run_id: nonEmptyString,
  body: nonEmptyString,
  author: nonEmptyString,
  created_at: nonEmptyString,
});

export const FeedbackSchema = z.object({
  schema_version: schemaVersionLiteral,
  iteration_id: nonEmptyString,
  entries: z.array(FeedbackEntrySchema).default([]),
});

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: ValidationResultError };

export interface ValidationResultError {
  message: string;
  issues: ReadonlyArray<{ path: PropertyKey[]; message: string; code: string }>;
}

export function validateWithSchema<S extends z.ZodType>(
  schema: S,
  data: unknown,
  label: string,
): ValidationResult<z.infer<S>> {
  const result = schema.safeParse(data);
  if (result.success) {
    return { ok: true, value: result.data as z.infer<S> };
  }
  const issues = result.error.issues.map((issue) => ({
    path: issue.path,
    message: issue.message,
    code: String(issue.code),
  }));
  return {
    ok: false,
    error: {
      message: `Validation failed for ${label}`,
      issues,
    },
  };
}

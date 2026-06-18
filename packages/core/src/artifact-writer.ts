import nodeFs from "node:fs";
import nodePath from "node:path";
import { promisify } from "node:util";

import { z } from "zod";
import type {
  Benchmark,
  EvalMetadata,
  Feedback,
  Grading,
  IterationMetadata,
  Metrics,
  Timing,
  Transcript,
} from "@skill-studio/schemas";
import {
  BenchmarkSchema,
  EvalMetadataSchema,
  FeedbackSchema,
  GradingSchema,
  IterationMetadataSchema,
  MetricsSchema,
  TimingSchema,
  TranscriptSchema,
  validateWithSchema,
} from "@skill-studio/schemas";

import { ProjectLoaderError } from "./errors.js";
import type { IterationPlan, RunAllocation } from "./run-paths.js";

const writeFile = promisify(nodeFs.writeFile);
const mkdir = promisify(nodeFs.mkdir);

const JSON_INDENT = 2;
const JSON_NEWLINE_AT_END = true;

export interface BuildIterationMetadataArgs {
  iteration_id: string;
  created_at: string;
  skill_version_ref: string;
  baseline: IterationMetadata["baseline"];
  evals_run: string[];
  status?: IterationMetadata["status"];
}

export function buildIterationMetadata(args: BuildIterationMetadataArgs): IterationMetadata {
  return {
    schema_version: 1,
    iteration_id: args.iteration_id,
    created_at: args.created_at,
    skill_version_ref: args.skill_version_ref,
    baseline: args.baseline,
    evals_run: args.evals_run,
    status: args.status ?? "planned",
  };
}

export async function writeIterationMetadata(
  iterationDir: string,
  metadata: IterationMetadata,
): Promise<string> {
  return writeJson(
    nodePath.join(iterationDir, "iteration.json"),
    metadata,
    IterationMetadataSchema,
    "iteration.json",
  );
}

export async function writeEvalMetadata(
  evalDir: string,
  metadata: EvalMetadata,
): Promise<string> {
  return writeJson(
    nodePath.join(evalDir, "eval_metadata.json"),
    metadata,
    EvalMetadataSchema,
    "eval_metadata.json",
  );
}

export async function writeTranscript(
  paths: RunAllocation,
  transcript: Transcript,
): Promise<string> {
  const result = validateWithSchema(TranscriptSchema, transcript, "transcript");
  if (!result.ok) {
    throw new ProjectLoaderError(
      `Internal artifact write failed schema for transcript at ${paths.paths.transcript_path}`,
      result.error,
    );
  }
  const markdown = renderTranscriptMarkdown(transcript);
  await mkdir(nodePath.dirname(paths.paths.transcript_path), { recursive: true });
  await writeFile(paths.paths.transcript_path, markdown, "utf8");
  return paths.paths.transcript_path;
}

export async function writePlaceholderTranscript(
  paths: RunAllocation,
  prompt: string,
): Promise<string> {
  const transcript: Transcript = {
    schema_version: 1,
    run_id: paths.run_id,
    entries: [
      {
        role: "user",
        content: prompt,
      },
    ],
  };
  return writeTranscript(paths, transcript);
}

export async function writeMetrics(paths: RunAllocation, metrics: Metrics): Promise<string> {
  return writeJson(paths.paths.metrics_path, metrics, MetricsSchema, "metrics.json");
}

export async function writePlaceholderMetrics(paths: RunAllocation): Promise<string> {
  const metrics: Metrics = {
    schema_version: 1,
    run_id: paths.run_id,
    tool_calls: 0,
    errors: [],
    notes: "placeholder: Phase 2 will populate real metrics",
  };
  return writeMetrics(paths, metrics);
}

export async function writeTiming(paths: RunAllocation, timing: Timing): Promise<string> {
  return writeJson(paths.paths.timing_path, timing, TimingSchema, "timing.json");
}

export async function writePlaceholderTiming(
  paths: RunAllocation,
  isoTimestamp?: string,
): Promise<string> {
  const stamp = isoTimestamp ?? "1970-01-01T00:00:00Z";
  const timing: Timing = {
    schema_version: 1,
    run_id: paths.run_id,
    started_at: stamp,
    ended_at: stamp,
    duration_ms: 0,
  };
  return writeTiming(paths, timing);
}

export async function writeGrading(paths: RunAllocation, grading: Grading): Promise<string> {
  return writeJson(paths.paths.grading_path, grading, GradingSchema, "grading.json");
}

export async function writePlaceholderGrading(
  paths: RunAllocation,
  assertions: string[],
): Promise<string> {
  const grading: Grading = {
    schema_version: 1,
    run_id: paths.run_id,
    grade_status: "pending",
    assertions: assertions.map((assertion) => ({
      assertion,
      passed: false,
      evidence: "placeholder: Phase 5 grader will populate evidence",
    })),
    summary: "",
  };
  return writeGrading(paths, grading);
}

export async function writeBenchmark(
  iterationDir: string,
  benchmark: Benchmark,
): Promise<string> {
  const jsonPath = await writeJson(
    nodePath.join(iterationDir, "benchmark.json"),
    benchmark,
    BenchmarkSchema,
    "benchmark.json",
  );
  const mdPath = nodePath.join(iterationDir, "benchmark.md");
  await writeFile(mdPath, renderBenchmarkMarkdown(benchmark), "utf8");
  return jsonPath;
}

export async function writePlaceholderBenchmark(
  iteration: IterationPlan,
  evalIds: string[],
  isoTimestamp?: string,
): Promise<string> {
  const benchmark: Benchmark = {
    schema_version: 1,
    iteration_id: iteration.iteration_id,
    generated_at: isoTimestamp ?? new Date(0).toISOString(),
    status: "pending",
    evals: evalIds.map((evalId) => ({
      eval_id: evalId,
      with_skill: null,
      baseline: null,
    })),
    notes: "placeholder: Phase 5 benchmark aggregator will populate this",
  };
  return writeBenchmark(iteration.iteration_dir, benchmark);
}

export async function writeFeedback(
  iterationDir: string,
  feedback: Feedback,
): Promise<string> {
  return writeJson(
    nodePath.join(iterationDir, "feedback.json"),
    feedback,
    FeedbackSchema,
    "feedback.json",
  );
}

export async function writePlaceholderFeedback(
  iteration: IterationPlan,
): Promise<string> {
  const feedback: Feedback = {
    schema_version: 1,
    iteration_id: iteration.iteration_id,
    entries: [],
  };
  return writeFeedback(iteration.iteration_dir, feedback);
}

async function writeJson<S extends z.ZodType>(
  filePath: string,
  data: unknown,
  schema: S,
  label: string,
): Promise<string> {
  const result = validateWithSchema(schema, data, label);
  if (!result.ok) {
    throw new ProjectLoaderError(
      `Internal artifact write failed schema for ${label} at ${filePath}`,
      result.error,
    );
  }
  await mkdir(nodePath.dirname(filePath), { recursive: true });
  const json = stringifyJson(result.value);
  await writeFile(filePath, json, "utf8");
  return filePath;
}

export function stringifyJson(value: unknown): string {
  const body = JSON.stringify(value, null, JSON_INDENT);
  return JSON_NEWLINE_AT_END ? `${body}\n` : body;
}

function renderTranscriptMarkdown(transcript: Transcript): string {
  const lines: string[] = [
    `# Transcript for ${transcript.run_id}`,
    "",
    "> Phase 1 placeholder transcript. Phase 2 will record real model interactions.",
    "",
  ];
  for (const entry of transcript.entries) {
    lines.push(`## ${entry.role}`);
    lines.push("");
    if (entry.timestamp) {
      lines.push(`<timestamp>${entry.timestamp}</timestamp>`);
      lines.push("");
    }
    lines.push(entry.content);
    lines.push("");
  }
  return lines.join("\n");
}

function renderBenchmarkMarkdown(benchmark: Benchmark): string {
  const lines: string[] = [
    `# Benchmark for ${benchmark.iteration_id}`,
    "",
    `- Status: ${benchmark.status}`,
    `- Generated at: ${benchmark.generated_at}`,
    "",
  ];
  if (benchmark.evals.length === 0) {
    lines.push("_No eval results yet._");
    lines.push("");
  } else {
    lines.push("| Eval | with_skill pass rate | baseline pass rate |");
    lines.push("| --- | --- | --- |");
    for (const entry of benchmark.evals) {
      const withSkill = formatRate(entry.with_skill?.pass_rate ?? null);
      const baseline = formatRate(entry.baseline?.pass_rate ?? null);
      lines.push(`| ${entry.eval_id} | ${withSkill} | ${baseline} |`);
    }
    lines.push("");
  }
  if (benchmark.notes.length > 0) {
    lines.push("## Notes");
    lines.push("");
    lines.push(benchmark.notes);
    lines.push("");
  }
  return lines.join("\n");
}

function formatRate(value: number | null): string {
  if (value === null) {
    return "—";
  }
  return `${(value * 100).toFixed(1)}%`;
}

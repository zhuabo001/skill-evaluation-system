import nodeFs from "node:fs";
import nodePath from "node:path";
import { promisify } from "node:util";

import type { RunArtifactPaths, RunConfigurationMode } from "@skill-studio/schemas";

import { ProjectLoaderError } from "./errors.js";

const readdir = promisify(nodeFs.readdir);
const stat = promisify(nodeFs.stat);

export const ITERATION_DIR_PREFIX = "iteration-";
export const EVAL_DIR_PREFIX = "eval-";
export const RUN_DIR_PREFIX = "run-";

export const CONFIGURATION_DIRS: readonly RunConfigurationMode[] = ["with_skill", "baseline"];

export interface IterationPlan {
  iteration_id: string;
  iteration_dir: string;
  iteration_metadata_path: string;
  benchmark_json_path: string;
  benchmark_md_path: string;
  next_iteration_index: number;
}

export async function allocateIteration(projectPath: string): Promise<IterationPlan> {
  const runsPath = nodePath.join(projectPath, "runs");
  const usedIndices = await listUsedIterationIndices(runsPath);
  const nextIndex = pickNextIndex(usedIndices);
  const iterationId = formatIterationId(nextIndex);
  return buildIterationPlan(projectPath, iterationId, nextIndex);
}

export function buildIterationPlan(
  projectPath: string,
  iterationId: string,
  iterationIndex: number,
): IterationPlan {
  const runsPath = nodePath.join(projectPath, "runs");
  const iterationDir = nodePath.join(runsPath, iterationId);
  return {
    iteration_id: iterationId,
    iteration_dir: iterationDir,
    iteration_metadata_path: nodePath.join(iterationDir, "iteration.json"),
    benchmark_json_path: nodePath.join(iterationDir, "benchmark.json"),
    benchmark_md_path: nodePath.join(iterationDir, "benchmark.md"),
    next_iteration_index: iterationIndex + 1,
  };
}

export function buildEvalDir(iterationDir: string, evalId: string): string {
  return nodePath.join(iterationDir, `${EVAL_DIR_PREFIX}${evalId}`);
}

export function buildConfigurationDir(evalDir: string, mode: RunConfigurationMode): string {
  return nodePath.join(evalDir, mode);
}

export interface AllocateRunArgs {
  eval_dir: string;
  mode: RunConfigurationMode;
  overwrite?: boolean;
}

export interface RunAllocation {
  mode: RunConfigurationMode;
  configuration_dir: string;
  run_id: string;
  paths: RunArtifactPaths;
}

export async function allocateRun(args: AllocateRunArgs): Promise<RunAllocation> {
  const configurationDir = buildConfigurationDir(args.eval_dir, args.mode);
  const usedIndices = await listUsedRunIndices(configurationDir);
  const nextIndex = pickNextIndex(usedIndices);
  const runId = formatRunId(nextIndex);
  return finalizeRunAllocation(configurationDir, args.mode, runId);
}

export function buildRunAt(
  evalDir: string,
  mode: RunConfigurationMode,
  runId: string,
): RunAllocation {
  const configurationDir = buildConfigurationDir(evalDir, mode);
  return finalizeRunAllocation(configurationDir, mode, runId);
}

function finalizeRunAllocation(
  configurationDir: string,
  mode: RunConfigurationMode,
  runId: string,
): RunAllocation {
  const runDir = nodePath.join(configurationDir, runId);
  const paths: RunArtifactPaths = {
    configuration: mode,
    iteration_dir: nodePath.dirname(nodePath.dirname(configurationDir)),
    eval_dir: nodePath.dirname(configurationDir),
    configuration_dir: configurationDir,
    run_dir: runDir,
    outputs_dir: nodePath.join(runDir, "outputs"),
    transcript_path: nodePath.join(runDir, "transcript.md"),
    metrics_path: nodePath.join(runDir, "metrics.json"),
    timing_path: nodePath.join(runDir, "timing.json"),
    grading_path: nodePath.join(runDir, "grading.json"),
  };
  return { mode, configuration_dir: configurationDir, run_id: runId, paths };
}

export async function ensureRunDirReady(
  allocation: RunAllocation,
  options: { overwrite?: boolean } = {},
): Promise<RunAllocation> {
  const runDir = allocation.paths.run_dir;
  const exists = await pathExists(runDir);
  if (exists && !options.overwrite) {
    throw new ProjectLoaderError(
      `Run directory already exists (use overwrite=true to bypass): ${runDir}`,
    );
  }
  await nodeFs.promises.mkdir(allocation.paths.outputs_dir, { recursive: true });
  return allocation;
}

export function formatIterationId(index: number): string {
  return `${ITERATION_DIR_PREFIX}${formatPadded(index)}`;
}

export function formatRunId(index: number): string {
  return `${RUN_DIR_PREFIX}${formatPadded(index)}`;
}

function formatPadded(index: number): string {
  return index.toString().padStart(3, "0");
}

function pickNextIndex(usedIndices: ReadonlySet<number>): number {
  if (usedIndices.size === 0) {
    return 1;
  }
  return Math.max(...Array.from(usedIndices)) + 1;
}

async function listUsedIterationIndices(runsPath: string): Promise<Set<number>> {
  return listUsedIndices(runsPath, ITERATION_DIR_PREFIX);
}

async function listUsedRunIndices(configurationDir: string): Promise<Set<number>> {
  return listUsedIndices(configurationDir, RUN_DIR_PREFIX);
}

async function listUsedIndices(
  parentDir: string,
  prefix: string,
): Promise<Set<number>> {
  let entries: string[];
  try {
    entries = await readdir(parentDir);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: unknown }).code === "ENOENT"
    ) {
      return new Set<number>();
    }
    throw error;
  }
  const indices = new Set<number>();
  for (const entry of entries) {
    if (!entry.startsWith(prefix)) {
      continue;
    }
    const suffix = entry.slice(prefix.length);
    const parsed = Number.parseInt(suffix, 10);
    if (Number.isFinite(parsed) && parsed > 0 && suffix === formatPadded(parsed)) {
      const info = await stat(nodePath.join(parentDir, entry)).catch(() => null);
      if (info && info.isDirectory()) {
        indices.add(parsed);
      }
    }
  }
  return indices;
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await stat(targetPath);
    return true;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: unknown }).code === "ENOENT"
    ) {
      return false;
    }
    throw error;
  }
}

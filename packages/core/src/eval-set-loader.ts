import nodeFs from "node:fs";
import nodePath from "node:path";
import { promisify } from "node:util";

import {
  EvalSetSchema,
  formatValidationErrors,
  validateWithSchema,
} from "@skill-studio/schemas";
import type { EvalSet } from "@skill-studio/schemas";

import { ProjectLoaderError } from "./errors.js";
import { isPathInside, normalizeRelativePath } from "./paths.js";

const readFile = promisify(nodeFs.readFile);
const realpath = promisify(nodeFs.realpath);
const stat = promisify(nodeFs.stat);

export interface LoadEvalSetOptions {
  filterDisabled?: boolean;
}

export interface LoadEvalSetResult {
  eval_set: EvalSet;
  enabled_evals: EvalSet["evals"];
}

export async function loadEvalSet(
  projectPath: string,
  skillId: string,
  options: LoadEvalSetOptions = {},
): Promise<LoadEvalSetResult> {
  const evalsJsonPath = nodePath.join(projectPath, "evals", "evals.json");
  const raw = await readFile(evalsJsonPath, "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch (error) {
    throw new ProjectLoaderError(
      `Failed to parse evals.json at ${evalsJsonPath}: ${(error as Error).message}`,
      error,
    );
  }
  const result = validateWithSchema(EvalSetSchema, parsed, "evals.json");
  if (!result.ok) {
    throw new ProjectLoaderError(
      `Invalid evals.json at ${evalsJsonPath}:\n${formatValidationErrors(result.error)}`,
      result.error,
    );
  }
  if (result.value.skill_id !== skillId) {
    throw new ProjectLoaderError(
      `evals.json skill_id mismatch: expected "${skillId}", got "${result.value.skill_id}"`,
    );
  }

  for (const evalCase of result.value.evals) {
    for (const file of evalCase.files) {
      await ensureInputFileSafe(projectPath, file);
    }
  }

  const filterDisabled = options.filterDisabled ?? true;
  const enabledEvals = filterDisabled
    ? result.value.evals.filter((evalCase) => evalCase.enabled)
    : result.value.evals;

  return {
    eval_set: result.value,
    enabled_evals: enabledEvals,
  };
}

async function ensureInputFileSafe(projectPath: string, relativeFile: string): Promise<void> {
  let absolutePath: string;
  try {
    absolutePath = normalizeRelativePath(projectPath, relativeFile);
  } catch (error) {
    throw new ProjectLoaderError(
      `Unsafe file path "${relativeFile}" referenced from evals.json: ${(error as Error).message}`,
      error,
    );
  }
  try {
    const projectRealPath = await realpath(projectPath);
    const info = await stat(absolutePath);
    if (!info.isFile()) {
      throw new ProjectLoaderError(`Eval input is not a file: ${relativeFile}`);
    }
    const inputRealPath = await realpath(absolutePath);
    if (!isPathInside(inputRealPath, projectRealPath)) {
      throw new ProjectLoaderError(
        `Eval input file escapes project root after resolving symlinks: ${relativeFile}`,
      );
    }
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: unknown }).code === "ENOENT"
    ) {
      throw new ProjectLoaderError(
        `Eval input file does not exist: ${relativeFile} (resolved to ${absolutePath})`,
      );
    }
    throw error;
  }
}

import nodeFs from "node:fs";
import { promisify } from "node:util";

import {
  PACKAGE_NAME as SCHEMAS_PACKAGE_NAME,
  SkillProjectManifestSchema,
  formatValidationErrors,
  validateWithSchema,
} from "@skill-studio/schemas";
import type {
  LoadedSkillProject,
  SkillProjectManifest,
} from "@skill-studio/schemas";
import { parse as parseYaml } from "yaml";

import { ProjectLoaderError } from "./errors.js";
import type { ProjectFilePaths } from "./paths.js";
import { getProjectFilePaths } from "./paths.js";

const readFile = promisify(nodeFs.readFile);
const mkdir = promisify(nodeFs.mkdir);
const stat = promisify(nodeFs.stat);

export const PACKAGE_NAME = "@skill-studio/core";
export { SCHEMAS_PACKAGE_NAME };

export interface LoadSkillProjectOptions {
  ensureResources?: boolean;
}

export async function loadSkillProject(
  projectPath: string,
  options: LoadSkillProjectOptions = {},
): Promise<LoadedSkillProject> {
  const paths = getProjectFilePaths(projectPath);

  await ensureDirectoryExists(paths.project_path, "project root");
  await ensureFileExists(paths.skill_yaml_path, "skill.yaml");
  await ensureFileExists(paths.instructions_path, "instructions.md");
  await ensureFileExists(paths.evals_json_path, "evals/evals.json");

  if (options.ensureResources) {
    await ensureDirectoryExists(paths.resources_path, "resources", true);
  }

  const manifest = await parseSkillYaml(paths.skill_yaml_path);
  const instructions = await readInstructions(paths.instructions_path);

  return {
    project_path: paths.project_path,
    manifest,
    instructions,
    skill_yaml_path: paths.skill_yaml_path,
    instructions_path: paths.instructions_path,
    evals_path: paths.evals_path,
    resources_path: paths.resources_path,
  };
}

export async function parseSkillYaml(skillYamlPath: string): Promise<SkillProjectManifest> {
  const raw = await readFile(skillYamlPath, "utf8");
  let parsed: unknown;
  try {
    parsed = parseYaml(raw);
  } catch (error) {
    throw new ProjectLoaderError(
      `Failed to parse skill.yaml at ${skillYamlPath}: ${(error as Error).message}`,
      error,
    );
  }
  const result = validateWithSchema(SkillProjectManifestSchema, parsed, "skill.yaml");
  if (!result.ok) {
    throw new ProjectLoaderError(
      `Invalid skill.yaml at ${skillYamlPath}:\n${formatValidationErrors(result.error)}`,
      result.error,
    );
  }
  return result.value;
}

export async function readInstructions(instructionsPath: string): Promise<string> {
  const content = await readFile(instructionsPath, "utf8");
  if (content.trim().length === 0) {
    throw new ProjectLoaderError(`instructions.md is empty at ${instructionsPath}`);
  }
  return content;
}

async function ensureFileExists(filePath: string, label: string): Promise<void> {
  try {
    const info = await stat(filePath);
    if (!info.isFile()) {
      throw new ProjectLoaderError(`${label} is not a file: ${filePath}`);
    }
  } catch (error) {
    if (isNotFoundError(error)) {
      throw new ProjectLoaderError(`Required ${label} is missing: ${filePath}`);
    }
    throw error;
  }
}

async function ensureDirectoryExists(
  dirPath: string,
  label: string,
  createIfMissing = false,
): Promise<void> {
  try {
    const info = await stat(dirPath);
    if (!info.isDirectory()) {
      throw new ProjectLoaderError(`${label} is not a directory: ${dirPath}`);
    }
  } catch (error) {
    if (isNotFoundError(error)) {
      if (createIfMissing) {
        await mkdir(dirPath, { recursive: true });
        return;
      }
      throw new ProjectLoaderError(`Required ${label} is missing: ${dirPath}`);
    }
    throw error;
  }
}

function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "ENOENT"
  );
}

export type { ProjectFilePaths };
export { getProjectFilePaths };

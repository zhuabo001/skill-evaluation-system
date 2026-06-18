import nodePath from "node:path";

export interface ProjectFilePaths {
  project_path: string;
  skill_yaml_path: string;
  instructions_path: string;
  evals_path: string;
  evals_json_path: string;
  resources_path: string;
  runs_path: string;
  reviews_path: string;
  exports_path: string;
}

export function getProjectFilePaths(projectPath: string): ProjectFilePaths {
  const absolute = toAbsolutePath(projectPath);
  return {
    project_path: absolute,
    skill_yaml_path: nodePath.join(absolute, "skill.yaml"),
    instructions_path: nodePath.join(absolute, "instructions.md"),
    evals_path: nodePath.join(absolute, "evals"),
    evals_json_path: nodePath.join(absolute, "evals", "evals.json"),
    resources_path: nodePath.join(absolute, "resources"),
    runs_path: nodePath.join(absolute, "runs"),
    reviews_path: nodePath.join(absolute, "reviews"),
    exports_path: nodePath.join(absolute, "exports"),
  };
}

export function toAbsolutePath(input: string): string {
  return nodePath.resolve(input);
}

export function isPathInside(childPath: string, parentPath: string): boolean {
  const relative = nodePath.relative(parentPath, childPath);
  if (relative === "") {
    return true;
  }
  return !relative.startsWith("..") && !nodePath.isAbsolute(relative);
}

export function joinRelative(projectPath: string, relativePath: string): string {
  return nodePath.join(projectPath, relativePath);
}

export function normalizeRelativePath(projectPath: string, candidate: string): string {
  if (nodePath.isAbsolute(candidate)) {
    throw new Error(`path must be relative, got absolute path: ${candidate}`);
  }
  if (candidate.includes("..")) {
    throw new Error(`path must not escape project root: ${candidate}`);
  }
  const absolute = nodePath.resolve(projectPath, candidate);
  if (!isPathInside(absolute, projectPath)) {
    throw new Error(`path escapes project root: ${candidate}`);
  }
  return absolute;
}

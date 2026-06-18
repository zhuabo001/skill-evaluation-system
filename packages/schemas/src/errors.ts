import type { ValidationResultError } from "./validators.js";

export interface FormatErrorOptions {
  indent?: number;
  bullet?: string;
}

export function formatValidationErrors(
  error: ValidationResultError,
  options: FormatErrorOptions = {},
): string {
  const indent = options.indent ?? 2;
  const bullet = options.bullet ?? "-";
  const pad = " ".repeat(indent);
  if (error.issues.length === 0) {
    return `${error.message}.`;
  }
  const lines = error.issues.map((issue) => {
    const pathStr = formatPath(issue.path);
    const suffix = pathStr.length > 0 ? ` at ${pathStr}` : "";
    return `${pad}${bullet} ${issue.message}${suffix} (code=${issue.code})`;
  });
  return `${error.message}:\n${lines.join("\n")}`;
}

export function formatPath(path: PropertyKey[]): string {
  if (path.length === 0) {
    return "(root)";
  }
  return path
    .map((segment, index) => {
      if (typeof segment === "number") {
        return `[${segment}]`;
      }
      return index === 0 ? String(segment) : `.${String(segment)}`;
    })
    .join("");
}

import { describe, expect, it } from "vitest";

import {
  EVAL_ID_REGEX,
  EvalSetSchema,
  IterationMetadataSchema,
  KEBAB_CASE_REGEX,
  MetricsSchema,
  SkillProjectManifestSchema,
  formatValidationErrors,
  validateWithSchema,
} from "./index.js";

describe("SkillProjectManifestSchema", () => {
  it("accepts a valid manifest", () => {
    const result = validateWithSchema(
      SkillProjectManifestSchema,
      {
        schema_version: 1,
        id: "sample-file-transformer",
        name: "Sample File Transformer",
        description: "Use this skill when transforming text into JSON.",
        status: "draft",
      },
      "skill.yaml",
    );
    expect(result.ok).toBe(true);
  });

  it("accepts the archived status", () => {
    const result = validateWithSchema(
      SkillProjectManifestSchema,
      {
        schema_version: 1,
        id: "sample",
        name: "Sample",
        description: "ok",
        status: "archived",
      },
      "skill.yaml",
    );
    expect(result.ok).toBe(true);
  });

  it("rejects missing schema_version", () => {
    const result = validateWithSchema(
      SkillProjectManifestSchema,
      { id: "sample", name: "Sample", description: "ok", status: "draft" },
      "skill.yaml",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(formatValidationErrors(result.error)).toContain("Validation failed");
    }
  });

  it("rejects wrong schema_version", () => {
    const result = validateWithSchema(
      SkillProjectManifestSchema,
      {
        schema_version: 2,
        id: "sample",
        name: "Sample",
        description: "ok",
        status: "draft",
      },
      "skill.yaml",
    );
    expect(result.ok).toBe(false);
  });

  it("rejects missing id", () => {
    const result = validateWithSchema(
      SkillProjectManifestSchema,
      { schema_version: 1, name: "Sample", description: "ok", status: "draft" },
      "skill.yaml",
    );
    expect(result.ok).toBe(false);
  });

  it("rejects non-kebab id", () => {
    const result = validateWithSchema(
      SkillProjectManifestSchema,
      {
        schema_version: 1,
        id: "Bad Id",
        name: "Sample",
        description: "ok",
        status: "draft",
      },
      "skill.yaml",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(formatValidationErrors(result.error)).toContain("kebab-case");
    }
  });

  it("rejects missing description", () => {
    const result = validateWithSchema(
      SkillProjectManifestSchema,
      { schema_version: 1, id: "sample", name: "Sample", status: "draft" },
      "skill.yaml",
    );
    expect(result.ok).toBe(false);
  });

  it("rejects invalid status", () => {
    const result = validateWithSchema(
      SkillProjectManifestSchema,
      {
        schema_version: 1,
        id: "sample",
        name: "Sample",
        description: "ok",
        status: "pending",
      },
      "skill.yaml",
    );
    expect(result.ok).toBe(false);
  });
});

describe("EvalSetSchema", () => {
  const validEval = {
    id: "text-to-json-summary",
    title: "Transform text notes into JSON summary",
    enabled: true,
    prompt: "Please read the notes file.",
    expected_output: "A summary.json file.",
    files: ["evals/files/notes.txt"],
    assertions: ["must include valid JSON"],
    tags: ["file-transform"],
  };

  it("accepts a valid eval set", () => {
    const result = validateWithSchema(
      EvalSetSchema,
      {
        schema_version: 1,
        skill_id: "sample-file-transformer",
        evals: [validEval],
      },
      "evals.json",
    );
    expect(result.ok).toBe(true);
  });

  it("rejects missing assertions", () => {
    const result = validateWithSchema(
      EvalSetSchema,
      {
        schema_version: 1,
        skill_id: "sample",
        evals: [{ ...validEval, assertions: [] }],
      },
      "evals.json",
    );
    expect(result.ok).toBe(false);
  });

  it("rejects duplicate eval ids", () => {
    const result = validateWithSchema(
      EvalSetSchema,
      {
        schema_version: 1,
        skill_id: "sample",
        evals: [validEval, { ...validEval }],
      },
      "evals.json",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(formatValidationErrors(result.error)).toContain("duplicate eval id");
    }
  });

  it("rejects non-kebab eval ids", () => {
    const result = validateWithSchema(
      EvalSetSchema,
      {
        schema_version: 1,
        skill_id: "sample",
        evals: [{ ...validEval, id: "UPPER_CASE" }],
      },
      "evals.json",
    );
    expect(result.ok).toBe(false);
  });

  it("rejects empty evals array", () => {
    const result = validateWithSchema(
      EvalSetSchema,
      { schema_version: 1, skill_id: "sample", evals: [] },
      "evals.json",
    );
    expect(result.ok).toBe(false);
  });
});

describe("IterationMetadataSchema", () => {
  it("accepts a planned iteration", () => {
    const result = validateWithSchema(
      IterationMetadataSchema,
      {
        schema_version: 1,
        iteration_id: "iteration-001",
        created_at: "2026-06-18T00:00:00Z",
        skill_version_ref: "working-tree",
        baseline: { type: "no_skill" },
        evals_run: ["text-to-json-summary"],
        status: "planned",
      },
      "iteration.json",
    );
    expect(result.ok).toBe(true);
  });

  it("rejects unknown status", () => {
    const result = validateWithSchema(
      IterationMetadataSchema,
      {
        schema_version: 1,
        iteration_id: "iteration-001",
        created_at: "2026-06-18T00:00:00Z",
        skill_version_ref: "working-tree",
        baseline: { type: "no_skill" },
        evals_run: [],
        status: "draft",
      },
      "iteration.json",
    );
    expect(result.ok).toBe(false);
  });
});

describe("MetricsSchema", () => {
  it("accepts valid metrics", () => {
    const result = validateWithSchema(
      MetricsSchema,
      {
        schema_version: 1,
        run_id: "run-001",
        tool_calls: 3,
        errors: [],
        notes: "",
      },
      "metrics.json",
    );
    expect(result.ok).toBe(true);
  });

  it("rejects negative tool_calls", () => {
    const result = validateWithSchema(
      MetricsSchema,
      {
        schema_version: 1,
        run_id: "run-001",
        tool_calls: -1,
        errors: [],
        notes: "",
      },
      "metrics.json",
    );
    expect(result.ok).toBe(false);
  });
});

describe("regexes", () => {
  it("matches kebab-case ids", () => {
    expect(KEBAB_CASE_REGEX.test("sample-file-transformer")).toBe(true);
    expect(KEBAB_CASE_REGEX.test("Sample")).toBe(false);
    expect(KEBAB_CASE_REGEX.test("with_underscore")).toBe(false);
    expect(KEBAB_CASE_REGEX.test("trailing-")).toBe(false);
  });

  it("EVAL_ID_REGEX behaves identically to kebab-case regex", () => {
    expect(EVAL_ID_REGEX.test("text-to-json-summary")).toBe(true);
    expect(EVAL_ID_REGEX.test("TextToJson")).toBe(false);
  });
});

describe("formatValidationErrors", () => {
  it("renders a single-issue error", () => {
    const result = validateWithSchema(
      SkillProjectManifestSchema,
      { schema_version: 1, id: "Bad", name: "x", description: "y", status: "draft" },
      "skill.yaml",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const text = formatValidationErrors(result.error);
      expect(text).toContain("skill.yaml");
      expect(text).toContain("kebab-case");
    }
  });
});

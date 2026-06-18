import nodeFs from "node:fs";
import nodeOs from "node:os";
import nodePath from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ProjectLoaderError, loadEvalSet } from "./index.js";

interface EvalFixture {
  root: string;
  evalsDir: string;
  writeEvalsJson(content: string): void;
  writeFile(relativePath: string, content: string): void;
}

function createEvalFixture(overrides: Partial<{
  evalsJson: string;
  files: Array<{ path: string; content: string }>;
}> = {}): EvalFixture {
  const root = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), "skill-studio-eval-"));
  const evalsDir = nodePath.join(root, "evals");
  nodeFs.mkdirSync(evalsDir, { recursive: true });
  nodeFs.mkdirSync(nodePath.join(evalsDir, "files"), { recursive: true });

  const defaultEvals = {
    schema_version: 1,
    skill_id: "sample-file-transformer",
    evals: [
      {
        id: "text-to-json-summary",
        title: "Transform text notes into JSON summary",
        enabled: true,
        prompt: "Please read the notes file.",
        expected_output: "A summary.json file.",
        files: ["evals/files/notes.txt"],
        assertions: ["The output includes a valid JSON file."],
        tags: ["file-transform"],
      },
    ],
  };
  nodeFs.writeFileSync(
    nodePath.join(evalsDir, "evals.json"),
    overrides.evalsJson ?? JSON.stringify(defaultEvals, null, 2),
    "utf8",
  );

  const files = overrides.files ?? [{ path: "evals/files/notes.txt", content: "Project Launch\n- Item" }];
  for (const file of files) {
    const fullPath = nodePath.join(root, file.path);
    nodeFs.mkdirSync(nodePath.dirname(fullPath), { recursive: true });
    nodeFs.writeFileSync(fullPath, file.content, "utf8");
  }

  return {
    root,
    evalsDir,
    writeEvalsJson(content: string): void {
      nodeFs.writeFileSync(nodePath.join(evalsDir, "evals.json"), content, "utf8");
    },
    writeFile(relativePath: string, content: string): void {
      const fullPath = nodePath.join(root, relativePath);
      nodeFs.mkdirSync(nodePath.dirname(fullPath), { recursive: true });
      nodeFs.writeFileSync(fullPath, content, "utf8");
    },
  };
}

describe("loadEvalSet", () => {
  let fixtures: string[] = [];

  beforeEach(() => {
    fixtures = [];
  });

  afterEach(() => {
    for (const fixture of fixtures) {
      nodeFs.rmSync(fixture, { recursive: true, force: true });
    }
  });

  it("loads a valid eval set", async () => {
    const fixture = createEvalFixture();
    fixtures.push(fixture.root);
    const result = await loadEvalSet(fixture.root, "sample-file-transformer");
    expect(result.eval_set.skill_id).toBe("sample-file-transformer");
    expect(result.enabled_evals).toHaveLength(1);
    expect(result.enabled_evals[0]?.id).toBe("text-to-json-summary");
  });

  it("rejects skill_id mismatch", async () => {
    const fixture = createEvalFixture();
    fixtures.push(fixture.root);
    await expect(loadEvalSet(fixture.root, "different-skill")).rejects.toThrow(
      /skill_id mismatch/,
    );
  });

  it("rejects missing input file", async () => {
    const fixture = createEvalFixture();
    fixtures.push(fixture.root);
    nodeFs.rmSync(nodePath.join(fixture.evalsDir, "files", "notes.txt"), { force: true });
    await expect(loadEvalSet(fixture.root, "sample-file-transformer")).rejects.toThrow(
      /does not exist/,
    );
  });

  it("rejects path traversal", async () => {
    const fixture = createEvalFixture({
      evalsJson: JSON.stringify({
        schema_version: 1,
        skill_id: "sample-file-transformer",
        evals: [
          {
            id: "traversal",
            title: "Tr",
            enabled: true,
            prompt: "p",
            expected_output: "o",
            files: ["../secret.txt"],
            assertions: ["a"],
            tags: [],
          },
        ],
      }),
    });
    fixtures.push(fixture.root);
    await expect(loadEvalSet(fixture.root, "sample-file-transformer")).rejects.toThrow(
      /Unsafe file path/,
    );
  });

  it("rejects symlinked input files that resolve outside the project root", async () => {
    const outsideRoot = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), "skill-studio-outside-"));
    fixtures.push(outsideRoot);
    const outsideFile = nodePath.join(outsideRoot, "secret.txt");
    nodeFs.writeFileSync(outsideFile, "outside project", "utf8");

    const fixture = createEvalFixture({
      evalsJson: JSON.stringify({
        schema_version: 1,
        skill_id: "sample-file-transformer",
        evals: [
          {
            id: "symlink-file",
            title: "Symlink file",
            enabled: true,
            prompt: "p",
            expected_output: "o",
            files: ["evals/files/link.txt"],
            assertions: ["a"],
            tags: [],
          },
        ],
      }),
      files: [],
    });
    fixtures.push(fixture.root);
    nodeFs.symlinkSync(outsideFile, nodePath.join(fixture.evalsDir, "files", "link.txt"));

    await expect(loadEvalSet(fixture.root, "sample-file-transformer")).rejects.toThrow(
      /escapes project root/,
    );
  });

  it("rejects duplicate eval ids", async () => {
    const fixture = createEvalFixture({
      evalsJson: JSON.stringify({
        schema_version: 1,
        skill_id: "sample-file-transformer",
        evals: [
          {
            id: "dup",
            title: "T1",
            enabled: true,
            prompt: "p",
            expected_output: "o",
            files: [],
            assertions: ["a"],
            tags: [],
          },
          {
            id: "dup",
            title: "T2",
            enabled: true,
            prompt: "p",
            expected_output: "o",
            files: [],
            assertions: ["a"],
            tags: [],
          },
        ],
      }),
    });
    fixtures.push(fixture.root);
    await expect(loadEvalSet(fixture.root, "sample-file-transformer")).rejects.toThrow(
      /duplicate eval id/,
    );
  });

  it("filters disabled evals by default", async () => {
    const fixture = createEvalFixture({
      evalsJson: JSON.stringify({
        schema_version: 1,
        skill_id: "sample-file-transformer",
        evals: [
          {
            id: "enabled-eval",
            title: "E",
            enabled: true,
            prompt: "p",
            expected_output: "o",
            files: [],
            assertions: ["a"],
            tags: [],
          },
          {
            id: "disabled-eval",
            title: "D",
            enabled: false,
            prompt: "p",
            expected_output: "o",
            files: [],
            assertions: ["a"],
            tags: [],
          },
        ],
      }),
    });
    fixtures.push(fixture.root);
    const result = await loadEvalSet(fixture.root, "sample-file-transformer");
    expect(result.enabled_evals).toHaveLength(1);
    expect(result.enabled_evals[0]?.id).toBe("enabled-eval");
  });

  it("keeps disabled evals when filterDisabled is false", async () => {
    const fixture = createEvalFixture({
      evalsJson: JSON.stringify({
        schema_version: 1,
        skill_id: "sample-file-transformer",
        evals: [
          {
            id: "disabled-eval",
            title: "D",
            enabled: false,
            prompt: "p",
            expected_output: "o",
            files: [],
            assertions: ["a"],
            tags: [],
          },
        ],
      }),
    });
    fixtures.push(fixture.root);
    const result = await loadEvalSet(fixture.root, "sample-file-transformer", {
      filterDisabled: false,
    });
    expect(result.enabled_evals).toHaveLength(1);
  });

  it("fails on malformed JSON", async () => {
    const fixture = createEvalFixture();
    fixtures.push(fixture.root);
    fixture.writeEvalsJson("{ not valid json");
    await expect(loadEvalSet(fixture.root, "sample-file-transformer")).rejects.toBeInstanceOf(
      ProjectLoaderError,
    );
  });
});

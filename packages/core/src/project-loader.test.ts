import nodeFs from "node:fs";
import nodeOs from "node:os";
import nodePath from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ProjectLoaderError, loadSkillProject } from "./index.js";

interface TempProjectFixture {
  root: string;
  writeSkillYaml(content: string): void;
  writeInstructions(content: string): void;
  writeEvalsJson(content: string): void;
  removeSkillYaml(): void;
  removeInstructions(): void;
  removeEvalsJson(): void;
}

function createTempProjectFixture(overrides: Partial<{
  skillYaml: string;
  instructions: string;
  evalsJson: string;
  withEvalsFiles: boolean;
}> = {}): TempProjectFixture {
  const root = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), "skill-studio-project-"));
  const skillYamlPath = nodePath.join(root, "skill.yaml");
  const instructionsPath = nodePath.join(root, "instructions.md");
  const evalsDir = nodePath.join(root, "evals");
  const evalsJsonPath = nodePath.join(evalsDir, "evals.json");
  nodeFs.mkdirSync(evalsDir, { recursive: true });
  nodeFs.writeFileSync(
    skillYamlPath,
    overrides.skillYaml ??
      `schema_version: 1
id: sample-file-transformer
name: Sample File Transformer
description: Use this skill to transform text into JSON.
status: draft
`,
    "utf8",
  );
  nodeFs.writeFileSync(
    instructionsPath,
    overrides.instructions ??
      `# Sample

Read the input file and emit a JSON summary.
`,
    "utf8",
  );
  nodeFs.writeFileSync(
    evalsJsonPath,
    overrides.evalsJson ??
      JSON.stringify(
        {
          schema_version: 1,
          skill_id: "sample-file-transformer",
          evals: [
            {
              id: "text-to-json-summary",
              title: "Transform text notes into JSON summary",
              enabled: true,
              prompt: "Please read the notes file.",
              expected_output: "A summary.json file.",
              files: [],
              assertions: ["The output includes a valid JSON file."],
              tags: [],
            },
          ],
        },
        null,
        2,
      ),
    "utf8",
  );
  if (overrides.withEvalsFiles) {
    nodeFs.mkdirSync(nodePath.join(evalsDir, "files"), { recursive: true });
    nodeFs.writeFileSync(
      nodePath.join(evalsDir, "files", "notes.txt"),
      "Project Launch Notes\n- Define MVP\n",
      "utf8",
    );
  }

  return {
    root,
    writeSkillYaml(content: string): void {
      nodeFs.writeFileSync(skillYamlPath, content, "utf8");
    },
    writeInstructions(content: string): void {
      nodeFs.writeFileSync(instructionsPath, content, "utf8");
    },
    writeEvalsJson(content: string): void {
      nodeFs.writeFileSync(evalsJsonPath, content, "utf8");
    },
    removeSkillYaml(): void {
      nodeFs.rmSync(skillYamlPath, { force: true });
    },
    removeInstructions(): void {
      nodeFs.rmSync(instructionsPath, { force: true });
    },
    removeEvalsJson(): void {
      nodeFs.rmSync(evalsJsonPath, { force: true });
    },
  };
}

describe("loadSkillProject", () => {
  let fixtures: string[] = [];

  beforeEach(() => {
    fixtures = [];
  });

  afterEach(() => {
    for (const fixture of fixtures) {
      nodeFs.rmSync(fixture, { recursive: true, force: true });
    }
  });

  it("loads a valid sample project", async () => {
    const fixture = createTempProjectFixture();
    fixtures.push(fixture.root);
    const project = await loadSkillProject(fixture.root);
    expect(project.manifest.id).toBe("sample-file-transformer");
    expect(project.manifest.status).toBe("draft");
    expect(project.instructions).toContain("Sample");
    expect(project.project_path).toBe(nodePath.resolve(fixture.root));
  });

  it("fails when skill.yaml is missing", async () => {
    const fixture = createTempProjectFixture();
    fixtures.push(fixture.root);
    fixture.removeSkillYaml();
    await expect(loadSkillProject(fixture.root)).rejects.toBeInstanceOf(ProjectLoaderError);
    await expect(loadSkillProject(fixture.root)).rejects.toThrow(/skill\.yaml/);
  });

  it("fails when instructions.md is missing", async () => {
    const fixture = createTempProjectFixture();
    fixtures.push(fixture.root);
    fixture.removeInstructions();
    await expect(loadSkillProject(fixture.root)).rejects.toThrow(/instructions\.md/);
  });

  it("fails when instructions.md is empty", async () => {
    const fixture = createTempProjectFixture({ instructions: "   \n  " });
    fixtures.push(fixture.root);
    await expect(loadSkillProject(fixture.root)).rejects.toThrow(/empty/);
  });

  it("fails when evals.json is missing", async () => {
    const fixture = createTempProjectFixture();
    fixtures.push(fixture.root);
    fixture.removeEvalsJson();
    await expect(loadSkillProject(fixture.root)).rejects.toThrow(/evals\.json/);
  });

  it("fails on bad YAML", async () => {
    const fixture = createTempProjectFixture({ skillYaml: "id: : :" });
    fixtures.push(fixture.root);
    await expect(loadSkillProject(fixture.root)).rejects.toThrow(/skill\.yaml/);
  });

  it("fails when status is invalid", async () => {
    const fixture = createTempProjectFixture({
      skillYaml:
        "schema_version: 1\nid: sample\nname: Sample\ndescription: ok\nstatus: unknown\n",
    });
    fixtures.push(fixture.root);
    await expect(loadSkillProject(fixture.root)).rejects.toThrow(/status/);
  });

  it("creates resources dir when ensureResources is true", async () => {
    const fixture = createTempProjectFixture();
    fixtures.push(fixture.root);
    const resourcesPath = nodePath.join(fixture.root, "resources");
    nodeFs.rmSync(resourcesPath, { recursive: true, force: true });
    await loadSkillProject(fixture.root, { ensureResources: true });
    expect(nodeFs.existsSync(resourcesPath)).toBe(true);
  });
});

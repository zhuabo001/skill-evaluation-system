import nodeFs from "node:fs";
import nodeOs from "node:os";
import nodePath from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  allocateIteration,
  allocateRun,
  buildEvalDir,
  buildIterationMetadata,
  ensureRunDirReady,
  loadEvalSet,
  loadSkillProject,
  writeEvalMetadata,
  writeIterationMetadata,
  writePlaceholderBenchmark,
  writePlaceholderFeedback,
  writePlaceholderGrading,
  writePlaceholderMetrics,
  writePlaceholderTiming,
  writePlaceholderTranscript,
} from "./index.js";

const HERE = nodePath.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PROJECT_PATH = nodePath.resolve(
  HERE,
  "../../../fixtures/sample-skill-project",
);

describe("fixture smoke: sample skill project", () => {
  let tempCopy: string | null = null;

  beforeEach(() => {
    tempCopy = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), "skill-studio-fixture-"));
    copyDirectory(FIXTURE_PROJECT_PATH, tempCopy);
  });

  afterEach(() => {
    if (tempCopy) {
      nodeFs.rmSync(tempCopy, { recursive: true, force: true });
    }
    tempCopy = null;
  });

  it("loads + validates + creates iteration-001 + writes placeholders end-to-end", async () => {
    if (!tempCopy) throw new Error("fixture copy not initialized");

    const project = await loadSkillProject(tempCopy);
    expect(project.manifest.id).toBe("sample-file-transformer");
    expect(project.instructions.length).toBeGreaterThan(0);

    const evalResult = await loadEvalSet(tempCopy, project.manifest.id);
    expect(evalResult.enabled_evals).toHaveLength(1);
    const sampleEval = evalResult.enabled_evals[0];
    if (!sampleEval) throw new Error("sample eval missing");

    const iteration = await allocateIteration(tempCopy);
    expect(iteration.iteration_id).toBe("iteration-001");

    const iterationMeta = buildIterationMetadata({
      iteration_id: iteration.iteration_id,
      created_at: "2026-06-18T00:00:00Z",
      skill_version_ref: "working-tree",
      baseline: { type: "no_skill" },
      evals_run: evalResult.enabled_evals.map((evalCase) => evalCase.id),
    });
    await writeIterationMetadata(iteration.iteration_dir, iterationMeta);

    const evalDir = buildEvalDir(iteration.iteration_dir, sampleEval.id);
    await writeEvalMetadata(evalDir, {
      schema_version: 1,
      eval_id: sampleEval.id,
      eval_name: sampleEval.id,
      prompt: sampleEval.prompt,
      expected_output: sampleEval.expected_output,
      files: sampleEval.files,
      assertions: sampleEval.assertions,
    });

    for (const mode of ["with_skill", "baseline"] as const) {
      const allocation = await allocateRun({ eval_dir: evalDir, mode });
      await ensureRunDirReady(allocation);
      await writePlaceholderTranscript(allocation, sampleEval.prompt);
      await writePlaceholderMetrics(allocation);
      await writePlaceholderTiming(allocation, "2026-06-18T00:00:00Z");
      await writePlaceholderGrading(allocation, sampleEval.assertions);
    }

    await writePlaceholderBenchmark(
      iteration,
      evalResult.enabled_evals.map((evalCase) => evalCase.id),
      "2026-06-18T00:00:00Z",
    );
    await writePlaceholderFeedback(iteration);

    const expectedTree = [
      "runs/iteration-001/iteration.json",
      "runs/iteration-001/eval-text-to-json-summary/eval_metadata.json",
      "runs/iteration-001/eval-text-to-json-summary/with_skill/run-001/transcript.md",
      "runs/iteration-001/eval-text-to-json-summary/with_skill/run-001/metrics.json",
      "runs/iteration-001/eval-text-to-json-summary/with_skill/run-001/timing.json",
      "runs/iteration-001/eval-text-to-json-summary/with_skill/run-001/grading.json",
      "runs/iteration-001/eval-text-to-json-summary/with_skill/run-001/outputs",
      "runs/iteration-001/eval-text-to-json-summary/baseline/run-001/transcript.md",
      "runs/iteration-001/eval-text-to-json-summary/baseline/run-001/metrics.json",
      "runs/iteration-001/eval-text-to-json-summary/baseline/run-001/timing.json",
      "runs/iteration-001/eval-text-to-json-summary/baseline/run-001/grading.json",
      "runs/iteration-001/eval-text-to-json-summary/baseline/run-001/outputs",
      "runs/iteration-001/benchmark.json",
      "runs/iteration-001/benchmark.md",
      "runs/iteration-001/feedback.json",
    ];
    for (const relative of expectedTree) {
      const absolute = nodePath.join(tempCopy, relative);
      expect(nodeFs.existsSync(absolute), `expected ${relative} to exist`).toBe(true);
    }
  });

  it("does not silently re-create run-001 if it already exists", async () => {
    if (!tempCopy) throw new Error("fixture copy not initialized");

    await loadSkillProject(tempCopy);
    const iteration = await allocateIteration(tempCopy);
    const evalDir = buildEvalDir(iteration.iteration_dir, "text-to-json-summary");
    const first = await allocateRun({ eval_dir: evalDir, mode: "with_skill" });
    await ensureRunDirReady(first);

    const next = await allocateRun({ eval_dir: evalDir, mode: "with_skill" });
    expect(next.run_id).not.toBe(first.run_id);
  });
});

function copyDirectory(source: string, destination: string): void {
  nodeFs.mkdirSync(destination, { recursive: true });
  for (const entry of nodeFs.readdirSync(source, { withFileTypes: true })) {
    const sourceEntry = nodePath.join(source, entry.name);
    const destinationEntry = nodePath.join(destination, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(sourceEntry, destinationEntry);
    } else if (entry.isFile()) {
      nodeFs.copyFileSync(sourceEntry, destinationEntry);
    }
  }
}

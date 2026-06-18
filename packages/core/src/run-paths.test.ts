import nodeFs from "node:fs";
import nodeOs from "node:os";
import nodePath from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  ProjectLoaderError,
  allocateIteration,
  allocateRun,
  buildConfigurationDir,
  buildEvalDir,
  buildIterationPlan,
  buildRunAt,
  ensureRunDirReady,
  formatIterationId,
  formatRunId,
} from "./index.js";

describe("formatIterationId / formatRunId", () => {
  it("zero-pads to three digits", () => {
    expect(formatIterationId(1)).toBe("iteration-001");
    expect(formatIterationId(42)).toBe("iteration-042");
    expect(formatRunId(1)).toBe("run-001");
    expect(formatRunId(123)).toBe("run-123");
  });
});

describe("buildIterationPlan", () => {
  it("emits canonical run directory layout", () => {
    const projectPath = nodePath.resolve("/tmp/sample");
    const plan = buildIterationPlan(projectPath, "iteration-001", 1);
    expect(plan.iteration_id).toBe("iteration-001");
    expect(plan.iteration_dir).toBe(nodePath.join(projectPath, "runs", "iteration-001"));
    expect(plan.iteration_metadata_path).toBe(
      nodePath.join(projectPath, "runs", "iteration-001", "iteration.json"),
    );
    expect(plan.benchmark_json_path).toBe(
      nodePath.join(projectPath, "runs", "iteration-001", "benchmark.json"),
    );
    expect(plan.benchmark_md_path).toBe(
      nodePath.join(projectPath, "runs", "iteration-001", "benchmark.md"),
    );
  });
});

describe("buildEvalDir / buildConfigurationDir / buildRunAt", () => {
  it("builds nested configuration paths", () => {
    const projectPath = nodePath.resolve("/tmp/sample");
    const iterationDir = nodePath.join(projectPath, "runs", "iteration-001");
    const evalDir = buildEvalDir(iterationDir, "text-to-json-summary");
    expect(evalDir).toBe(nodePath.join(iterationDir, "eval-text-to-json-summary"));
    expect(buildConfigurationDir(evalDir, "with_skill")).toBe(
      nodePath.join(evalDir, "with_skill"),
    );
    expect(buildConfigurationDir(evalDir, "baseline")).toBe(nodePath.join(evalDir, "baseline"));
  });

  it("buildRunAt returns canonical artifact paths", () => {
    const projectPath = nodePath.resolve("/tmp/sample");
    const iterationDir = nodePath.join(projectPath, "runs", "iteration-001");
    const evalDir = buildEvalDir(iterationDir, "text-to-json-summary");
    const allocation = buildRunAt(evalDir, "with_skill", "run-001");
    expect(allocation.mode).toBe("with_skill");
    expect(allocation.run_id).toBe("run-001");
    expect(allocation.paths.run_dir).toBe(
      nodePath.join(evalDir, "with_skill", "run-001"),
    );
    expect(allocation.paths.outputs_dir).toBe(
      nodePath.join(evalDir, "with_skill", "run-001", "outputs"),
    );
    expect(allocation.paths.transcript_path).toBe(
      nodePath.join(evalDir, "with_skill", "run-001", "transcript.md"),
    );
    expect(allocation.paths.metrics_path).toBe(
      nodePath.join(evalDir, "with_skill", "run-001", "metrics.json"),
    );
    expect(allocation.paths.timing_path).toBe(
      nodePath.join(evalDir, "with_skill", "run-001", "timing.json"),
    );
    expect(allocation.paths.grading_path).toBe(
      nodePath.join(evalDir, "with_skill", "run-001", "grading.json"),
    );
  });

  it("buildRunAt also works for baseline", () => {
    const projectPath = nodePath.resolve("/tmp/sample");
    const iterationDir = nodePath.join(projectPath, "runs", "iteration-001");
    const evalDir = buildEvalDir(iterationDir, "text-to-json-summary");
    const allocation = buildRunAt(evalDir, "baseline", "run-001");
    expect(allocation.paths.run_dir).toBe(
      nodePath.join(evalDir, "baseline", "run-001"),
    );
  });
});

describe("allocateIteration / allocateRun on disk", () => {
  let tempRoot: string | null = null;

  beforeEach(() => {
    tempRoot = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), "skill-studio-paths-"));
  });

  afterEach(() => {
    if (tempRoot) {
      nodeFs.rmSync(tempRoot, { recursive: true, force: true });
    }
    tempRoot = null;
  });

  it("allocates iteration-001 on first run and increments afterwards", async () => {
    if (!tempRoot) throw new Error("fixture not initialized");
    const first = await allocateIteration(tempRoot);
    expect(first.iteration_id).toBe("iteration-001");
    nodeFs.mkdirSync(first.iteration_dir, { recursive: true });

    const second = await allocateIteration(tempRoot);
    expect(second.iteration_id).toBe("iteration-002");
  });

  it("allocates run-001 on first run and increments afterwards", async () => {
    if (!tempRoot) throw new Error("fixture not initialized");
    const iteration = await allocateIteration(tempRoot);
    nodeFs.mkdirSync(iteration.iteration_dir, { recursive: true });
    const evalDir = buildEvalDir(iteration.iteration_dir, "eval-a");

    const first = await allocateRun({ eval_dir: evalDir, mode: "with_skill" });
    expect(first.run_id).toBe("run-001");
    await ensureRunDirReady(first);

    const second = await allocateRun({ eval_dir: evalDir, mode: "with_skill" });
    expect(second.run_id).toBe("run-002");
  });

  it("does not silently overwrite an existing run directory", async () => {
    if (!tempRoot) throw new Error("fixture not initialized");
    const iteration = await allocateIteration(tempRoot);
    const evalDir = buildEvalDir(iteration.iteration_dir, "eval-a");
    const first = await allocateRun({ eval_dir: evalDir, mode: "with_skill" });
    await ensureRunDirReady(first);
    nodeFs.writeFileSync(nodePath.join(first.paths.run_dir, "marker.txt"), "x", "utf8");

    const second = buildRunAt(evalDir, "with_skill", "run-001");
    await expect(ensureRunDirReady(second)).rejects.toBeInstanceOf(ProjectLoaderError);

    await expect(
      ensureRunDirReady(second, { overwrite: true }),
    ).resolves.toBeDefined();
  });
});

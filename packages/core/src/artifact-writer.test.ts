import nodeFs from "node:fs";
import nodeOs from "node:os";
import nodePath from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  allocateIteration,
  allocateRun,
  buildEvalDir,
  buildIterationMetadata,
  ensureRunDirReady,
  writeEvalMetadata,
  writeIterationMetadata,
  writePlaceholderBenchmark,
  writePlaceholderFeedback,
  writePlaceholderGrading,
  writePlaceholderMetrics,
  writePlaceholderTiming,
  writePlaceholderTranscript,
} from "./index.js";

interface TempDir {
  root: string;
}

function createTempDir(): TempDir {
  const root = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), "skill-studio-artifacts-"));
  return { root };
}

function destroyTempDir(temp: TempDir): void {
  nodeFs.rmSync(temp.root, { recursive: true, force: true });
}

function readJson(filePath: string): unknown {
  const raw = nodeFs.readFileSync(filePath, "utf8");
  return JSON.parse(raw) as unknown;
}

describe("writeIterationMetadata", () => {
  let temp: TempDir;

  beforeEach(() => {
    temp = createTempDir();
  });

  afterEach(() => {
    destroyTempDir(temp);
  });

  it("writes a planned iteration.json", async () => {
    const iteration = await allocateIteration(temp.root);
    const metadata = buildIterationMetadata({
      iteration_id: iteration.iteration_id,
      created_at: "2026-06-18T00:00:00Z",
      skill_version_ref: "working-tree",
      baseline: { type: "no_skill" },
      evals_run: ["text-to-json-summary"],
    });
    await writeIterationMetadata(iteration.iteration_dir, metadata);
    const onDisk = readJson(iteration.iteration_metadata_path) as {
      iteration_id: string;
      status: string;
    };
    expect(onDisk.iteration_id).toBe("iteration-001");
    expect(onDisk.status).toBe("planned");
  });
});

describe("writeEvalMetadata", () => {
  let temp: TempDir;

  beforeEach(() => {
    temp = createTempDir();
  });

  afterEach(() => {
    destroyTempDir(temp);
  });

  it("writes eval_metadata.json next to run directories", async () => {
    const iteration = await allocateIteration(temp.root);
    const evalDir = buildEvalDir(iteration.iteration_dir, "text-to-json-summary");
    await writeEvalMetadata(evalDir, {
      schema_version: 1,
      eval_id: "text-to-json-summary",
      eval_name: "text-to-json-summary",
      prompt: "Please read the notes file.",
      expected_output: "A summary.json file.",
      files: ["evals/files/notes.txt"],
      assertions: ["The output includes a valid JSON file."],
    });
    const target = nodePath.join(evalDir, "eval_metadata.json");
    expect(nodeFs.existsSync(target)).toBe(true);
  });
});

describe("placeholder writers", () => {
  let temp: TempDir;

  beforeEach(() => {
    temp = createTempDir();
  });

  afterEach(() => {
    destroyTempDir(temp);
  });

  async function setupRun(temp: TempDir) {
    const iteration = await allocateIteration(temp.root);
    const evalDir = buildEvalDir(iteration.iteration_dir, "text-to-json-summary");
    const allocation = await allocateRun({ eval_dir: evalDir, mode: "with_skill" });
    await ensureRunDirReady(allocation);
    return { iteration, evalDir, allocation };
  }

  it("writes a readable transcript.md placeholder", async () => {
    const { allocation } = await setupRun(temp);
    await writePlaceholderTranscript(allocation, "Please summarize the notes.");
    const body = nodeFs.readFileSync(allocation.paths.transcript_path, "utf8");
    expect(body).toContain("Transcript for run-001");
    expect(body).toContain("Please summarize the notes.");
  });

  it("writes a stable metrics.json placeholder", async () => {
    const { allocation } = await setupRun(temp);
    await writePlaceholderMetrics(allocation);
    const data = readJson(allocation.paths.metrics_path) as { tool_calls: number };
    expect(data.tool_calls).toBe(0);
  });

  it("writes a stable timing.json placeholder", async () => {
    const { allocation } = await setupRun(temp);
    await writePlaceholderTiming(allocation, "2026-06-18T00:00:00Z");
    const data = readJson(allocation.paths.timing_path) as {
      duration_ms: number;
      started_at: string;
    };
    expect(data.duration_ms).toBe(0);
    expect(data.started_at).toBe("2026-06-18T00:00:00Z");
  });

  it("writes a placeholder grading.json with one assertion row", async () => {
    const { allocation } = await setupRun(temp);
    await writePlaceholderGrading(allocation, ["The output includes a valid JSON file."]);
    const data = readJson(allocation.paths.grading_path) as {
      assertions: Array<{ assertion: string; passed: boolean }>;
    };
    expect(data.assertions).toHaveLength(1);
    expect(data.assertions[0]?.assertion).toContain("valid JSON");
    expect(data.assertions[0]?.passed).toBe(false);
  });

  it("writes a placeholder benchmark.json and benchmark.md", async () => {
    const { iteration } = await setupRun(temp);
    await writePlaceholderBenchmark(iteration, ["text-to-json-summary"], "2026-06-18T00:00:00Z");
    const benchmarkJsonPath = nodePath.join(iteration.iteration_dir, "benchmark.json");
    const benchmarkMdPath = nodePath.join(iteration.iteration_dir, "benchmark.md");
    const data = readJson(benchmarkJsonPath) as { status: string; evals: Array<{ eval_id: string }> };
    expect(data.status).toBe("pending");
    expect(data.evals).toHaveLength(1);
    const md = nodeFs.readFileSync(benchmarkMdPath, "utf8");
    expect(md).toContain("Benchmark for iteration-001");
  });

  it("writes a placeholder feedback.json with no entries", async () => {
    const { iteration } = await setupRun(temp);
    await writePlaceholderFeedback(iteration);
    const feedbackPath = nodePath.join(iteration.iteration_dir, "feedback.json");
    const data = readJson(feedbackPath) as { entries: unknown[] };
    expect(Array.isArray(data.entries)).toBe(true);
    expect(data.entries).toHaveLength(0);
  });
});

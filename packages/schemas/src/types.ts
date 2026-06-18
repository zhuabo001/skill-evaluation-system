import type {
  BaselineType,
  BenchmarkStatus,
  GradingStatus,
  IterationStatus,
  RunConfigurationMode,
  SkillProjectStatus,
} from "./constants.js";

export interface SkillProjectManifest {
  schema_version: 1;
  id: string;
  name: string;
  description: string;
  status: SkillProjectStatus;
}

export interface LoadedSkillProject {
  project_path: string;
  manifest: SkillProjectManifest;
  instructions: string;
  skill_yaml_path: string;
  instructions_path: string;
  evals_path: string;
  resources_path: string;
}

export interface EvalCase {
  id: string;
  title: string;
  enabled: boolean;
  prompt: string;
  expected_output: string;
  files: string[];
  assertions: string[];
  tags: string[];
}

export interface EvalSet {
  schema_version: 1;
  skill_id: string;
  evals: EvalCase[];
}

export interface IterationBaseline {
  type: BaselineType;
  ref?: string;
}

export interface IterationMetadata {
  schema_version: 1;
  iteration_id: string;
  created_at: string;
  skill_version_ref: string;
  baseline: IterationBaseline;
  evals_run: string[];
  status: IterationStatus;
}

export interface EvalMetadata {
  schema_version: 1;
  eval_id: string;
  eval_name: string;
  prompt: string;
  expected_output: string;
  files: string[];
  assertions: string[];
}

export interface RunConfiguration {
  skill_id: string;
  eval_id: string;
  mode: RunConfigurationMode;
  model?: ModelConfig;
}

export interface RunArtifactPaths {
  configuration: RunConfigurationMode;
  iteration_dir: string;
  eval_dir: string;
  configuration_dir: string;
  run_dir: string;
  outputs_dir: string;
  transcript_path: string;
  metrics_path: string;
  timing_path: string;
  grading_path: string;
}

export interface TranscriptEntry {
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  timestamp?: string;
}

export interface Transcript {
  schema_version: 1;
  run_id: string;
  entries: TranscriptEntry[];
}

export interface Metrics {
  schema_version: 1;
  run_id: string;
  tool_calls: number;
  errors: string[];
  notes: string;
}

export interface Timing {
  schema_version: 1;
  run_id: string;
  started_at: string;
  ended_at: string;
  duration_ms: number;
}

export interface GradingAssertion {
  assertion: string;
  passed: boolean;
  evidence: string;
}

export interface Grading {
  schema_version: 1;
  run_id: string;
  grade_status: GradingStatus;
  assertions: GradingAssertion[];
  summary: string;
}

export interface BenchmarkRunRef {
  grading_path: string;
  pass_rate: number | null;
}

export interface BenchmarkEval {
  eval_id: string;
  with_skill: BenchmarkRunRef | null;
  baseline: BenchmarkRunRef | null;
}

export interface Benchmark {
  schema_version: 1;
  iteration_id: string;
  generated_at: string;
  status: BenchmarkStatus;
  evals: BenchmarkEval[];
  notes: string;
}

export interface FeedbackEntry {
  eval_id: string;
  configuration: RunConfigurationMode;
  run_id: string;
  body: string;
  author: string;
  created_at: string;
}

export interface Feedback {
  schema_version: 1;
  iteration_id: string;
  entries: FeedbackEntry[];
}

export interface ModelConfig {
  provider: "anthropic" | "openai";
  model: string;
  temperature?: number;
  max_tokens?: number;
}

export interface RuntimeFileRef {
  path: string;
  kind: "input" | "output" | "artifact";
}

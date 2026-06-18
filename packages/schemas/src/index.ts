export const PACKAGE_NAME = "@skill-studio/schemas";

export interface SkillProject {
  schema_version: number;
  id: string;
  name: string;
  description: string;
  status: "draft" | "active";
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
  schema_version: number;
  skill_id: string;
  evals: EvalCase[];
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

export interface RunConfiguration {
  skill_id: string;
  eval_id: string;
  mode: "with_skill" | "baseline";
  model: ModelConfig;
}

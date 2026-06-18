import type { RuntimeFileRef, RunConfiguration } from "@skill-studio/schemas";

export const PACKAGE_NAME = "@skill-studio/runtime";

export type { SkillProject, EvalSet, RunConfiguration } from "@skill-studio/schemas";

export interface AgentRunRequest {
  prompt: string;
  files?: RuntimeFileRef[];
  config: RunConfiguration;
  workspace_dir: string;
}

export interface AgentRunResult {
  ok: boolean;
  outputs: RuntimeFileRef[];
  transcript_path: string;
  metrics_path: string;
  timing_path: string;
}

export interface AgentRuntime {
  run(req: AgentRunRequest): Promise<AgentRunResult>;
}

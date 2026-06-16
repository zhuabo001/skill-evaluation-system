import type { ModelConfig } from "@skill-studio/schemas";

export const PACKAGE_NAME = "@skill-studio/model-adapters";

export type { ModelConfig } from "@skill-studio/schemas";

export interface ModelMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ModelToolSpec {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface ModelRequest {
  messages: ModelMessage[];
  tools?: ModelToolSpec[];
  config: ModelConfig;
}

export interface ModelToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ModelRunResult {
  stop_reason: "stop" | "tool_use" | "max_tokens" | "error";
  content: string;
  tool_calls?: ModelToolCall[];
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface ModelAdapter {
  call(req: ModelRequest): Promise<ModelRunResult>;
}

# @skill-studio/model-adapters

Provider-neutral adapter interface plus per-provider implementations. Core and runtime never depend on a specific provider SDK — only on the `ModelAdapter` interface defined here.

## Phase 0 scope

- `ModelAdapter` interface draft.
- `ModelRequest` / `ModelRunResult` shapes.
- Provider subdirectory placeholders (`providers/anthropic/`, `providers/openai/`).

## Phase 4 (planned)

- First concrete provider adapter (Anthropic or OpenAI).
- Tool call roundtrip handling.
- Token usage reporting.

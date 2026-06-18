# @skill-studio/runtime

Defines the agent runtime surface that executes skill eval tasks in a controlled workspace.

## Phase 0 scope

- `AgentRuntime` interface draft.
- `AgentRunRequest` / `AgentRunResult` shapes.
- Re-exports shared types from `@skill-studio/schemas`.

## Phase 2 (planned)

- `NativeAgentRuntime` implementation.
- Tool dispatch loop (`file.read`, `file.write`, `file.list`, `shell.run`, `artifact.save_note`).
- Transcript / metrics / timing recorders.
- Permission policy stub.

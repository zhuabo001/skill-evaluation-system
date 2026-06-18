# @skill-studio/core

Owns the lifecycle of skill projects, eval sets, iterations, and run artifacts.

## Phase 0 scope

- Package skeleton only.
- Re-exports shared types from `@skill-studio/schemas` to prove the dependency edge.

## Phase 1 (planned)

- Project loader (`skill.yaml` + `instructions.md`).
- Eval set loader (`evals/evals.json`).
- Iteration / run path builder.
- Artifact writer.

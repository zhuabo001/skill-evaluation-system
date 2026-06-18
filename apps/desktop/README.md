# Skill Studio Desktop (apps/desktop)

Tauri-based desktop shell for Skill Studio.

## Phase 0 status

**This directory is a placeholder.** Phase 0 does not initialize a Tauri project — that lands in Phase 6 once the headless vertical slice (schemas → runtime → with-skill/baseline → grader/benchmark) is working.

## Phase 6 plan

When Phase 6 starts, run from this directory:

```bash
cargo tauri init
```

The desktop shell will then wire into `@skill-studio/core` and `@skill-studio/runtime` via Tauri commands — it should never contain business logic itself.

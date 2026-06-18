# Skill Studio

Local-first desktop tooling for engineering, evaluating, and iterating on AI skills. Phase 0 ships the monorepo skeleton only — no business logic yet.

## Status

**V1 Phase 0: engineering skeleton.** See [`v1/plans/v1-phase-0-plan.md`](./v1/plans/v1-phase-0-plan.md) for scope and [`v1/plans/v1-development-routine.md`](./v1/plans/v1-development-routine.md) for the full phase roadmap.

## Repository layout

```
.
├── AGENTS.md                                    # agent-facing memory context
├── reference/                                   # reference skill-creator implementation (Python)
├── v1/plans/                                    # V1 planning docs (read-only)
├── v2/                                          # reserved for V2 planning docs
├── package.json                                 # workspace root
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── apps/desktop/                                # Tauri desktop shell (placeholder in Phase 0)
├── packages/
│   ├── schemas/                                 # shared types + (Phase 1) Zod validators
│   ├── core/                                    # project/eval/run/benchmark lifecycle
│   ├── runtime/                                 # NativeAgentRuntime + tool protocol
│   ├── model-adapters/                          # Anthropic/OpenAI adapters
│   └── document-tools/                          # PDF/XLSX/DOCX helpers (Phase 0 placeholder)
├── fixtures/sample-skill-project/               # realistic skill eval fixture
└── scripts/                                     # repo-level helper scripts (placeholder)
```

## Prerequisites

- Node.js 22+
- pnpm 10+

## Commands

Run from the repository root:

```bash
pnpm install        # install workspace dependencies
pnpm typecheck      # tsc --noEmit across every package
pnpm test           # vitest smoke tests
pnpm lint           # placeholder in Phase 0
```

## Phase 0 scope

Phase 0 only establishes:

- pnpm workspace with five TypeScript packages
- shared type aliases in `packages/schemas`
- `AgentRuntime` and `ModelAdapter` interface drafts
- a sample skill project fixture usable by Phase 1
- minimal `typecheck` / `test` commands

The following are explicitly **out of scope** in Phase 0 (planned for later phases):

- Tauri desktop app initialization (Phase 6)
- with-skill / baseline dual runs (Phase 3)
- real model API calls (Phase 4)
- grader, benchmark, review UI (Phase 5+)
- `.skill` packaging (Phase 8)
- Zod validators (Phase 1)

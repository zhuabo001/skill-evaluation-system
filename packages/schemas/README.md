# @skill-studio/schemas

Shared data contracts for Skill Studio. Every other package depends on this one — never the reverse.

## Phase 0 scope

- Type aliases for the core domain shapes (`SkillProject`, `EvalCase`, `EvalSet`, `ModelConfig`, `RuntimeFileRef`, `RunConfiguration`).
- No validators yet.

## Phase 1 (planned)

- Zod validators mirroring each type.
- Readable parse error reporting for fixture loading.

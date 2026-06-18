# V1 Phase 1 Implementation Record

> 关联 plan: `/v1/plans/v1-phase-1-plan.md`
> 关联 progress: `/v1/progress/v1-phase-1-plan-progress.md`
> 完成日期: 2026-06-18
> 起始 commit: `391636b`（main）
> 收尾 commit: `d6767aa`（dev/phase_1）

## 1. 目标摘要

Phase 1 固定了 Skill Studio 的核心数据模型与 artifact contract，让 schema、loader、path builder、artifact writer 全部围绕同一套结构工作。Phase 1 不实现 runtime / grader / benchmark / review UI，只是把资产格式钉死，避免后续 phase 各自发明不兼容结构。

## 2. 主要改动

### 2.1 `packages/schemas`

| 文件 | 内容 |
| --- | --- |
| `src/constants.ts` | 共享常量（schema version、状态枚举、kebab-case 正则、迭代/run 前缀） |
| `src/types.ts` | Phase 1 plan §5.1 列出的全部类型（SkillProjectManifest、LoadedSkillProject、EvalSet、EvalCase、IterationMetadata、EvalMetadata、RunConfiguration、RunArtifactPaths、Transcript、Metrics、Timing、Grading、Benchmark、Feedback 等） |
| `src/validators.ts` | Zod 4 validators + `validateWithSchema` helper（覆盖 duplicate id、kebab-case、schema_version 字面量、assertions 非空等） |
| `src/errors.ts` | `formatValidationErrors` 把 zod issues 渲染成可读多行错误信息 |
| `src/validators.test.ts` | 20 个 validator 单元测试，含失败用例 |

依赖：新增 `zod@^4.4.3`、`yaml@^2.9.0`。

### 2.2 `packages/core`

| 文件 | 内容 |
| --- | --- |
| `src/errors.ts` | `ProjectLoaderError` 错误类型，链式 cause |
| `src/paths.ts` + `src/eval-set-loader.ts` | 路径解析 / 安全检查（`normalizeRelativePath` 拒绝绝对路径与 `..`；eval 输入文件额外通过 `realpath` 确认 symlink 解析后仍在 project root 内） |
| `src/project-loader.ts` | `loadSkillProject` + `parseSkillYaml` + `readInstructions`，校验 skill.yaml/instructions/evals.json 存在 |
| `src/eval-set-loader.ts` | `loadEvalSet`，校验 skill_id、files 存在、path traversal、duplicate id、可选过滤 disabled |
| `src/run-paths.ts` | `allocateIteration` / `allocateRun` / `buildRunAt` / `buildRunArtifactPaths` / `ensureRunDirReady`，遵守 `iteration-001`/`eval-<id>`/`with_skill\|baseline`/`run-001` 约定，不静默覆盖 |
| `src/artifact-writer.ts` | `writeIterationMetadata` / `writeEvalMetadata` + 6 个 placeholder writer（transcript/metrics/timing/grading/benchmark/feedback），全部走 Zod 校验后写盘 |
| `src/project-loader.test.ts` | 8 个 project loader 测试 |
| `src/eval-set-loader.test.ts` | 9 个 eval set loader 测试（含 path traversal、symlink escape、duplicate id） |
| `src/run-paths.test.ts` | 8 个 path builder 测试（含不静默覆盖） |
| `src/artifact-writer.test.ts` | 8 个 artifact writer 测试 |
| `src/fixture-smoke.test.ts` | 2 个端到端 fixture smoke 测试 |

依赖：新增 `yaml@^2.9.0`、`zod@^4.4.3`、`@types/node`（dev），`tsconfig.json` 增加 `"types": ["node"]`。

### 2.3 `packages/runtime`

仅同步类型重命名：`SkillProject` → `SkillProjectManifest`（schemas 包改名后的连锁影响）。

## 3. 测试与质量

- 根 `pnpm typecheck`：5 个包全部通过（document-tools、schemas、runtime、model-adapters、core）。
- 根 `pnpm test`：`packages/core` 5 个测试文件 35 个用例全部通过；其他包没有 Phase 1 范围内的测试。
- 涵盖的对抗性场景：
  - skill.yaml 缺字段 / 非法 status / 非 kebab id。
  - instructions.md 缺失 / 空白。
  - evals.json 解析错误 / skill_id 不匹配 / 重复 id。
  - 文件路径越界（`../secret.txt`）/ symlink 解析后逃逸 project root / 缺失文件。
  - iteration / run 编号递增。
  - 重复 run 目录默认拒绝、显式 `overwrite=true` 才放行。
  - 端到端 fixture 全路径生成（含 `with_skill` + `baseline` + `outputs/` + `benchmark.md`）。

## 4. 对其他模块的影响

- **`packages/runtime`**：`SkillProject` 类型导出更名为 `SkillProjectManifest`。后续 Phase 2 实现 NativeAgentRuntime 时需要从 `@skill-studio/schemas` 引用新名称。
- **`packages/model-adapters`**：未触及，仍消费 `ModelConfig`。
- **`packages/document-tools`**：未触及。
- **`apps/desktop`**：未触及，Phase 1 不接 Tauri UI。
- **`fixtures/sample-skill-project`**：未修改，但被新增的 fixture smoke test 完整跑过一遍，验证了目录布局与 eval 资产可被 loader 正确消费。

## 5. Phase 2 接入点

- Phase 2 NativeAgentRuntime 直接调用 `loadSkillProject` + `loadEvalSet` + `allocateIteration` + `allocateRun` 拿到 `RunArtifactPaths`，再把 transcript / metrics / timing 写入对应文件即可。
- `writePlaceholder*` 系列函数留有 schema_version 与扩展字段，Phase 2 / Phase 5 可以原地替换为真实数据，无需新建文件。
- `RunArtifactPaths` 已经包含 `outputs_dir`，Phase 2 模型生成的产物落盘路径固定。

## 6. 已知遗留

- Phase 1 不实现 grader 真实评分，`writePlaceholderGrading` 写入 `grade_status: "pending"`，由 Phase 5 替换。
- `writePlaceholderBenchmark` 写入 `status: "pending"`，Phase 5 聚合时替换。
- `feedback.json` 在 Phase 1 仅写入空 entries，Phase 6 / 7 的 Review UI 写入真实反馈。

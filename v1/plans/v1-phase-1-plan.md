# V1 Phase 1 Plan: Data Models and Artifact Contract

## 1. Phase 1 目标

Phase 1 的目标是固定 Skill Studio 的核心数据模型与 artifact contract，让后续 runtime、grader、benchmark、review UI 都围绕同一套结构工作。

Phase 1 不运行真实 agent，不接模型 API，不做 with-skill/baseline 双跑。它只负责让项目资产可以被稳定加载、校验、建目录、写入占位 artifacts。

## 2. Phase 1 非目标

Phase 1 不做以下事情：

- 不实现 NativeAgentRuntime。
- 不调用 Anthropic/OpenAI。
- 不实现 tool dispatch loop。
- 不实现 grader 评分逻辑。
- 不实现 benchmark 聚合逻辑。
- 不实现 review UI。
- 不实现 baseline/with-skill 双跑。
- 不实现 `.skill` 导出。

Phase 1 的边界是 schema、loader、path builder、artifact writer 和 fixture-based smoke tests。

## 3. 开发原则

1. Artifact contract 优先于运行逻辑。
2. 所有后续 package 都应消费 `packages/schemas` 的 shared types 和 validators。
3. `packages/core` 只负责业务路径和文件组织，不负责模型调用。
4. 目录结构和 JSON 字段要稳定，避免后续 runtime/review UI 各自发明格式。
5. 错误信息必须可读，方便开发者定位坏 fixture 或坏项目资产。

## 4. 核心资产契约

Phase 1 需要定义以下文件和目录的最小有效结构。

### 4.1 Skill Project

```text
my-skill-project/
├── skill.yaml
├── instructions.md
├── resources/
│   ├── scripts/
│   ├── references/
│   └── assets/
├── evals/
│   ├── evals.json
│   └── files/
├── runs/
├── reviews/
└── exports/
```

### 4.2 skill.yaml

职责：

- 描述通用 Skill Project 的身份、状态和默认运行配置。
- 不直接绑定 Claude Skill frontmatter。

最小字段：

```yaml
schema_version: 1
id: sample-file-transformer
name: Sample File Transformer
description: Use this skill when the user needs to transform a text input file into a structured JSON summary.
status: draft
```

Phase 1 validator 至少检查：

- `schema_version` 必须存在且为 `1`。
- `id` 必须为 kebab-case。
- `name` 必须为非空字符串。
- `description` 必须为非空字符串。
- `status` 必须为 `draft`、`active` 或 `archived`。

### 4.3 instructions.md

职责：

- 保存模型后续 with-skill run 要注入的主指令。

Phase 1 loader 至少检查：

- 文件存在。
- 内容非空。
- 返回原始 markdown 文本。

### 4.4 evals/evals.json

职责：

- 保存 eval case 资产。
- 每个 eval case 必须可被 path builder 转换为后续 run 目录。

最小结构：

```json
{
  "schema_version": 1,
  "skill_id": "sample-file-transformer",
  "evals": [
    {
      "id": "text-to-json-summary",
      "title": "Transform text notes into JSON summary",
      "enabled": true,
      "prompt": "Please read the attached notes file and turn it into a JSON summary.",
      "expected_output": "A summary.json file with title, items, and item_count.",
      "files": ["evals/files/notes.txt"],
      "assertions": [
        "The output includes a valid JSON file.",
        "The JSON contains title, items, and item_count.",
        "item_count matches the number of items."
      ],
      "tags": ["file-transform", "json"]
    }
  ]
}
```

Phase 1 validator 至少检查：

- `schema_version` 必须存在且为 `1`。
- `skill_id` 必须匹配 `skill.yaml` 的 `id`。
- `evals` 必须是非空数组。
- `evals[].id` 必须稳定、唯一、适合作为目录名。
- `prompt`、`expected_output`、`assertions` 必须非空。
- `files[]` 指向的输入文件必须存在，且不能逃逸 project root。

### 4.5 iteration.json

职责：

- 描述一次 eval iteration 的计划和状态。

Phase 1 只写入占位/计划型 iteration，不执行真实 run。

最小结构：

```json
{
  "schema_version": 1,
  "iteration_id": "iteration-001",
  "created_at": "2026-06-18T00:00:00Z",
  "skill_version_ref": "working-tree",
  "baseline": {
    "type": "no_skill"
  },
  "evals_run": ["text-to-json-summary"],
  "status": "planned"
}
```

### 4.6 Run Directory Structure

Phase 1 path builder 必须生成以下目录结构：

```text
runs/
└── iteration-001/
    ├── iteration.json
    ├── eval-text-to-json-summary/
    │   ├── eval_metadata.json
    │   ├── with_skill/
    │   │   └── run-001/
    │   │       ├── outputs/
    │   │       ├── transcript.md
    │   │       ├── metrics.json
    │   │       └── timing.json
    │   └── baseline/
    │       └── run-001/
    │           ├── outputs/
    │           ├── transcript.md
    │           ├── metrics.json
    │           └── timing.json
    ├── benchmark.json
    └── benchmark.md
```

Phase 1 不生成真实执行内容，但要能写入占位 artifacts。

### 4.7 eval_metadata.json

职责：

- 将 eval case 的关键字段复制到具体 eval run 目录，方便 runtime/grader/review UI 不回溯全局 eval set。

最小结构：

```json
{
  "schema_version": 1,
  "eval_id": "text-to-json-summary",
  "eval_name": "text-to-json-summary",
  "prompt": "Please read the attached notes file and turn it into a JSON summary.",
  "expected_output": "A summary.json file with title, items, and item_count.",
  "files": ["evals/files/notes.txt"],
  "assertions": [
    "The output includes a valid JSON file.",
    "The JSON contains title, items, and item_count.",
    "item_count matches the number of items."
  ]
}
```

### 4.8 Placeholder Artifacts

Phase 1 artifact writer 应能写入占位版本：

```text
transcript.md
metrics.json
timing.json
grading.json
benchmark.json
benchmark.md
feedback.json
```

占位文件必须使用后续 Phase 2/5 可继续写入或替换的字段结构。

## 5. Package 分工

### 5.1 packages/schemas

职责：

- 定义 shared types。
- 定义 Zod validators。
- 导出 parse/validate helper。
- 输出可读 validation error。

Phase 1 重点类型：

- `SkillProjectManifest`
- `LoadedSkillProject`
- `EvalSet`
- `EvalCase`
- `IterationMetadata`
- `EvalMetadata`
- `RunConfiguration`
- `RunArtifactPaths`
- `Transcript`
- `Metrics`
- `Timing`
- `Grading`
- `Benchmark`
- `Feedback`

### 5.2 packages/core

职责：

- `loadSkillProject(projectPath)`
- `loadEvalSet(projectPath)`
- `buildIterationPlan(...)`
- `buildRunArtifactPaths(...)`
- `writeEvalMetadata(...)`
- `writePlaceholderArtifacts(...)`

`packages/core` 不直接读模型 API，不执行 shell，不实现 runtime。

## 6. Phase 1 任务拆分

### Task 1.1: 完善 schema validators

交付物：

- `packages/schemas` 中的 Zod validators。
- shared TypeScript types。
- validation error formatter。

验收：

- valid `skill.yaml` pass。
- missing required fields fail。
- invalid `id` fail。
- invalid `status` fail。
- valid `evals/evals.json` pass。
- duplicate eval ids fail。

### Task 1.2: 实现 project loader

交付物：

- `packages/core` 中的 project loader。

loader 行为：

- 读取 `skill.yaml`。
- 读取 `instructions.md`。
- 确认 `evals/evals.json` 存在。
- 确认 resources 目录存在或可被创建。
- 返回 normalized project object。

验收：

- sample project load pass。
- missing `skill.yaml` fail。
- missing `instructions.md` fail。
- empty `instructions.md` fail。
- bad YAML fail with readable error。

### Task 1.3: 实现 eval set loader

交付物：

- `packages/core` 中的 eval set loader。

loader 行为：

- 读取 `evals/evals.json`。
- 校验 `skill_id` 与 project id 一致。
- 校验 `files[]` 存在。
- 拒绝 path traversal。
- 默认过滤或标记 disabled evals。

验收：

- sample eval set load pass。
- invalid eval file path fail。
- file outside project root fail。
- duplicate eval ids fail。

### Task 1.4: 实现 iteration/run path builder

交付物：

- iteration id builder。
- eval directory name builder。
- run directory path builder。
- artifact path object。

路径约定：

- iteration 使用 `iteration-001` 递增格式。
- eval 目录使用 `eval-<eval-id>`。
- configuration 使用 `with_skill` 和 `baseline`。
- run 使用 `run-001` 递增格式。

验收：

- creates iteration path。
- creates eval path。
- creates with_skill run path。
- creates baseline run path。
- repeated calls do not silently overwrite existing run directories unless explicitly requested。

### Task 1.5: 实现 artifact writer

交付物：

- `writeIterationMetadata`
- `writeEvalMetadata`
- `writePlaceholderTranscript`
- `writePlaceholderMetrics`
- `writePlaceholderTiming`
- `writePlaceholderGrading`
- `writePlaceholderBenchmark`
- `writePlaceholderFeedback`

验收：

- 能创建标准 run 目录。
- 能写入占位 artifacts。
- JSON 文件格式化稳定。
- markdown placeholder 可读。

### Task 1.6: 用 fixture 写 smoke tests

交付物：

- fixture-based tests。
- sample project artifact generation test。

验收：

- 从 `fixtures/sample-skill-project` 加载项目。
- 读取 eval set。
- 创建 `iteration-001`。
- 为 sample eval 创建 with_skill/baseline run 目录。
- 写入全部占位 artifacts。

## 7. Test Plan

### 7.1 Schema validator tests

- valid `skill.yaml` pass。
- missing `schema_version` fail。
- missing `id` fail。
- invalid kebab-case id fail。
- missing `description` fail。
- valid `evals/evals.json` pass。
- missing `assertions` fail。
- duplicate eval ids fail。
- invalid eval file path fail。

### 7.2 Loader tests

- sample project load pass。
- missing `skill.yaml` fail。
- missing `instructions.md` fail。
- empty `instructions.md` fail。
- missing `evals/evals.json` fail。
- `skill_id` mismatch fail。
- input file path outside project root fail。

### 7.3 Artifact writer tests

- creates iteration path。
- creates eval path。
- creates with_skill run path。
- creates baseline run path。
- writes placeholder `transcript.md`。
- writes placeholder `metrics.json`。
- writes placeholder `timing.json`。
- writes placeholder `grading.json`。
- writes placeholder `benchmark.json`。

## 8. Phase 1 验收标准

Phase 1 完成时，应该能够做到：

```text
load sample skill project
  -> validate skill.yaml
  -> validate instructions.md
  -> load evals/evals.json
  -> validate input files
  -> create iteration-001
  -> create with_skill/baseline run directories
  -> write placeholder artifacts
```

明确验收：

- 能加载 sample skill project。
- 能校验 `skill.yaml` 和 `evals/evals.json`。
- 能生成标准 iteration/run 目录。
- 能写入空/占位版 artifacts。
- schema 校验能报出可读错误。
- Phase 2 可以直接把 NativeAgentRuntime 输出写入这些路径。

## 9. 风险与检查点

### 9.1 Artifact 字段过度设计

风险：

- Phase 1 试图一次性定义完整业务字段，拖慢开发。

控制：

- 只定义 Phase 2/5 已知需要的最小字段，保留 `schema_version` 和可扩展字段。

### 9.2 Loader 做了 Runtime 的工作

风险：

- `packages/core` 提前承担执行逻辑，后续和 runtime 边界混乱。

控制：

- Core 只加载、校验、建目录、写 metadata，不调用模型或 shell。

### 9.3 路径安全后置

风险：

- Phase 2 runtime 继承不安全路径假设。

控制：

- Phase 1 loader/path builder 就要拒绝 path traversal 和 project root 逃逸。

### 9.4 Fixture 不足以支撑 Phase 2

风险：

- Phase 2 无法用 fixture 验证真实模型读取文件和写 outputs。

控制：

- fixture 必须包含真实 input file、prompt、expected output、assertions。

## 10. 推荐完成顺序

```text
1. schemas validators
2. project loader
3. eval set loader
4. iteration/run path builder
5. artifact writer
6. fixture smoke tests
```

这个顺序可以让 Phase 2 直接消费稳定的 project/eval/run paths，而不是在 runtime 中临时拼目录或临时定义 artifact 格式。


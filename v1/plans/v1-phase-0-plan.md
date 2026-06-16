# V1 Phase 0 Plan: Engineering Skeleton

## 1. Phase 0 目标

Phase 0 的目标是建立 V1 后续开发所需的工程骨架，让 desktop app、core engine、agent runtime、model adapters、schemas、document tools 可以独立演进，同时又能通过统一的 workspace、测试命令和 fixtures 串起来。

Phase 0 不追求实现完整功能。它的核心产物是一个可以持续开发的 monorepo 基础设施，以及一个可以支撑 Phase 1/2 的 sample project fixture。

## 2. Phase 0 非目标

Phase 0 不做以下事情：

- 不实现完整 Tauri UI。
- 不实现真实 with-skill / baseline 双跑。
- 不实现完整 Agent Runtime tool loop。
- 不接真实 OpenAI/Anthropic API。
- 不实现 grader、benchmark、review UI。
- 不实现 PDF/XLSX/DOCX 真实处理逻辑。
- 不实现 `.skill` 打包导出。

Phase 0 只做工程边界、目录结构、基础脚本、类型约定、fixtures 和最小 smoke test。

## 3. 开发原则

1. 先搭可测试的 headless 基础，再接 desktop UI。
2. packages 之间依赖方向必须清晰，避免循环依赖。
3. schemas 要尽早成为跨 package 的公共契约。
4. fixtures 必须能模拟后续 skill eval 场景，而不是随便放一个 hello world。
5. Phase 0 的完成标准是“后续 phase 可以在此基础上直接开工”，不是“看起来像产品”。

## 4. 推荐工程结构

```text
.
├── apps/
│   └── desktop/
│       ├── README.md
│       └── src/
├── packages/
│   ├── schemas/
│   │   ├── README.md
│   │   └── src/
│   ├── core/
│   │   ├── README.md
│   │   └── src/
│   ├── runtime/
│   │   ├── README.md
│   │   └── src/
│   ├── model-adapters/
│   │   ├── README.md
│   │   └── src/
│   └── document-tools/
│       ├── README.md
│       └── src/
├── fixtures/
│   └── sample-skill-project/
│       ├── skill.yaml
│       ├── instructions.md
│       ├── resources/
│       │   ├── scripts/
│       │   ├── references/
│       │   └── assets/
│       └── evals/
│           ├── evals.json
│           └── files/
├── docs/
│   └── architecture/
├── scripts/
│   └── README.md
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

说明：

- `apps/desktop` 只放 Tauri 桌面应用，不承载核心业务逻辑。
- `packages/schemas` 是所有 package 的公共数据契约。
- `packages/core` 负责 project/eval/run/benchmark 业务生命周期。
- `packages/runtime` 负责 NativeAgentRuntime 和工具调用协议。
- `packages/model-adapters` 负责 provider API 适配。
- `packages/document-tools` 负责后续 PDF/XLSX/DOCX helper。
- `fixtures/sample-skill-project` 用于 Phase 1/2 的测试输入。

## 5. Package 边界

### 5.1 packages/schemas

职责：

- 定义 shared types。
- 定义 schema validators。
- 定义错误格式。
- 给其他 packages 提供稳定数据契约。

Phase 0 只需要先放置 skeleton 和少量占位类型，不需要完成全部 schema。

建议最早定义：

- `SkillProject`
- `EvalSet`
- `EvalCase`
- `ModelConfig`
- `RuntimeFileRef`
- `RunConfiguration`

### 5.2 packages/core

职责：

- 读取 project。
- 读取 evals。
- 构造 run plan。
- 管理 iteration/run 路径。
- 调用 runtime、grader、benchmark。

Phase 0 只做：

- package skeleton。
- README。
- 依赖 `packages/schemas` 的 smoke import。

### 5.3 packages/runtime

职责：

- 定义 `AgentRuntime` 接口。
- 定义 tool protocol。
- 后续实现 NativeAgentRuntime。

Phase 0 只做：

- package skeleton。
- `AgentRuntime` 接口草案。
- 依赖 `packages/schemas` 的 smoke import。

### 5.4 packages/model-adapters

职责：

- 适配 Anthropic/OpenAI 的消息和 tool calling。
- 输出 provider-neutral `ModelRunResult`。

Phase 0 只做：

- package skeleton。
- `ModelAdapter` 接口草案。
- provider 子目录占位。

### 5.5 packages/document-tools

职责：

- 后续提供 PDF/XLSX/DOCX inspect/render/extract helper。

Phase 0 只做：

- package skeleton。
- README 说明边界。
- 不引入重型依赖。

### 5.6 apps/desktop

职责：

- Tauri 桌面 shell。
- 本地文件选择。
- 权限提示。
- 与 core/runtime 通信。

Phase 0 可以只建目录和 README。是否真正初始化 Tauri 工程可以作为可选项，因为初始化 Tauri 会引入更多依赖和配置成本。

## 6. 技术边界建议

### 6.1 TypeScript / Rust / Python 分工

Phase 0 先不要过早实现复杂跨语言调用，但要明确方向：

- TypeScript：schemas、core、runtime orchestration、model adapters、UI shared types。
- Rust：Tauri backend、权限弹窗、受控进程调用、OS 集成。
- Python：document helper 和后续 deterministic checker，可通过子进程调用。

Phase 0 建议先把 `packages/*` 用 TypeScript skeleton 建起来。Rust/Tauri 工程可以只保留 app 目录与说明，等 Phase 6 正式接 desktop shell 时再扩展。

### 6.2 包管理

建议使用 pnpm workspace。

Phase 0 需要：

- 根 `package.json`。
- `pnpm-workspace.yaml`。
- 每个 package 独立 `package.json`。
- 根命令聚合：
  - `typecheck`
  - `test`
  - `lint`

如果暂时不引入 lint 工具，可以先让命令明确占位，不要假装已经有完整 lint。

### 6.3 Schema 校验

Phase 0 可以先选定 schema 策略，不一定实现完整字段。

可选方向：

- TypeScript type + Zod validators。
- JSON Schema + TypeScript type generation。

建议 V1 初期使用 TypeScript type + Zod validators，开发速度更快，也方便前端复用。

## 7. Sample Skill Project Fixture

Phase 0 必须建立一个接近真实 skill eval 的 fixture，而不是普通 hello world。

建议 fixture：

```text
fixtures/sample-skill-project/
├── skill.yaml
├── instructions.md
├── resources/
│   ├── scripts/
│   ├── references/
│   └── assets/
└── evals/
    ├── evals.json
    └── files/
```

### 7.1 skill.yaml

示例内容：

```yaml
schema_version: 1
id: sample-file-transformer
name: Sample File Transformer
description: Use this skill when the user needs to transform a text input file into a structured JSON summary.
status: draft
```

### 7.2 instructions.md

示例内容应模拟真实 skill 指令：

```md
# Sample File Transformer

Read the user's input text file, identify the title and bullet-like lines, and produce a JSON summary in `outputs/summary.json`.

The JSON should include:

- `title`
- `items`
- `item_count`
```

### 7.3 evals/evals.json

示例内容：

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

### 7.4 evals/files/notes.txt

示例内容：

```text
Project Launch Notes
- Define MVP scope
- Build headless runtime
- Add review workspace
```

## 8. Phase 0 任务拆分

### Task 0.1: 初始化 workspace 文件

交付物：

- 根 `README.md`。
- 根 `package.json`。
- `pnpm-workspace.yaml`。
- `.gitignore`。

验收：

- `pnpm install` 后 workspace 可识别所有 packages。
- 根 README 能说明项目目的和目录结构。

### Task 0.2: 创建 package skeleton

交付物：

- `packages/schemas`
- `packages/core`
- `packages/runtime`
- `packages/model-adapters`
- `packages/document-tools`

每个 package 至少包含：

- `package.json`
- `README.md`
- `src/index.ts`

验收：

- 每个 package 可以被 TypeScript 编译。
- 每个 package 可以从根命令中参与 typecheck。

### Task 0.3: 定义初始 shared types

交付物：

- `packages/schemas/src/index.ts`
- 初始类型：
  - `SkillProject`
  - `EvalSet`
  - `EvalCase`
  - `ModelConfig`
  - `RuntimeFileRef`
  - `RunConfiguration`

验收：

- `packages/core` 可以 import shared types。
- `packages/runtime` 可以 import shared types。
- typecheck 通过。

### Task 0.4: 定义核心接口草案

交付物：

- `packages/runtime/src/index.ts`
  - `AgentRuntime`
  - `AgentRunRequest`
  - `AgentRunResult`
- `packages/model-adapters/src/index.ts`
  - `ModelAdapter`
  - `ModelRequest`
  - `ModelRunResult`

验收：

- runtime/model adapter 接口不依赖 UI。
- 接口可以表达后续 with-skill 和 baseline 模式。

### Task 0.5: 创建 sample fixture

交付物：

- `fixtures/sample-skill-project/skill.yaml`
- `fixtures/sample-skill-project/instructions.md`
- `fixtures/sample-skill-project/evals/evals.json`
- `fixtures/sample-skill-project/evals/files/notes.txt`

验收：

- fixture 能代表一个最小 skill eval 场景。
- 后续 Phase 1 可以直接用它测试 project loader。

### Task 0.6: 创建 desktop app 占位

交付物：

- `apps/desktop/README.md`
- `apps/desktop/src/`

验收：

- README 明确 desktop app 暂时不是 Phase 0 的主实现目标。
- 后续 Phase 6 可以基于该目录初始化 Tauri。

### Task 0.7: 建立基础测试命令

交付物：

- 根 `package.json` scripts：
  - `typecheck`
  - `test`
  - `lint`

验收：

- `typecheck` 可运行。
- `test` 可运行，即使初期只有 smoke test。
- `lint` 若暂未接入，应清楚标注为占位或最小检查。

## 9. Phase 0 验收标准

Phase 0 完成时，应满足：

- repo 中存在清晰的 monorepo/package 结构。
- `apps/desktop`、`packages/*`、`fixtures/*` 均已建立。
- shared schema package 可以被其他 package 引用。
- runtime/model adapter 接口草案已定义。
- sample skill project fixture 已存在。
- 基础 `typecheck/test/lint` 命令存在并可运行。
- 后续 Phase 1 可以直接开始实现 project/eval schema validators。
- 后续 Phase 2 可以直接开始实现 NativeAgentRuntime。

## 10. Phase 0 不应该卡住的问题

以下问题不应阻塞 Phase 0：

- 最终 UI 使用 React、Vue 还是 Svelte。
- Tauri 具体版本。
- OpenAI 和 Anthropic 先接哪一个。
- PDF/XLSX/DOCX 使用哪个具体库。
- 是否接 DeepAgents。
- 是否实现完整 permission prompt。
- 是否支持多模型对比。

这些问题可以在后续 phase 再定。Phase 0 只需要建立清晰边界，让后续选择有落点。

## 11. 风险与检查点

### 11.1 过早 UI 化

风险：

- 花时间做 desktop 壳，但 core/runtime 仍不可用。

控制：

- Phase 0 只保留 desktop 占位，不把 UI 当主线。

### 11.2 抽象过度

风险：

- 先做一个过于通用的 agent runtime，反而无法支撑 skill eval artifact。

控制：

- 所有接口都围绕 eval/run/artifact 设计。

### 11.3 Schema 后置

风险：

- runtime、grader、review UI 各自生成不同格式。

控制：

- Phase 0 就建立 `packages/schemas`。

### 11.4 Fixture 太玩具化

风险：

- sample 无法暴露真实文件型任务的问题。

控制：

- fixture 必须包含 input file、eval prompt、expected output、assertions。

## 12. 推荐完成顺序

```text
1. 根 workspace 配置
2. package skeleton
3. shared types
4. runtime/model adapter 接口草案
5. sample skill project fixture
6. desktop app 占位
7. smoke test/typecheck 命令
```

这个顺序能让 Phase 1 和 Phase 2 同时具备启动条件：Phase 1 可以基于 schemas 和 fixture 做 project/eval loader，Phase 2 可以基于 runtime 接口开始实现 NativeAgentRuntime。


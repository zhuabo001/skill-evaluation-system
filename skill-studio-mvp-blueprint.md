# Skill Studio MVP Blueprint

## 1. 产品定位

Skill Studio 是一个面向个人开发者的本地桌面应用，用来把 skill 当成工程对象来创建、评测、审核、迭代和导出。

它不是一个聊天套壳，也不是一开始就面向团队的 Web 中台。MVP 的核心价值是：

- 把 eval case、输入文件、断言、运行结果、人工反馈和 benchmark 都沉淀成项目资产。
- 让开发者能在本地安全地运行 with-skill 与 baseline 两组任务。
- 提供比命令行更适合人工审核的 review UI。
- 为下一阶段的“模型自动修改 skill”预留完整数据闭环。

第一类用户是开发者自己。团队协作、远程 runner、权限审计、skill registry、benchmark 排行等能力放到后续团队版或 Web 中台版本。

## 2. 参考工作流抽象

`reference/` 中的 Claude Code skill-creator 工作流可以抽象成以下工程循环：

```text
Define Skill Goal
  -> Draft Skill
  -> Create Eval Cases
  -> Run With Skill + Baseline
  -> Grade Outputs
  -> Aggregate Benchmark
  -> Human Review
  -> Improve Skill
  -> Repeat
  -> Optimize Description
  -> Package
```

MVP 保留其中的工程资产和 review/benchmark 闭环，但暂时后置自动改写 skill：

```text
Human edits/imports skill
  -> Human manages eval assets
  -> System runs with_skill + baseline
  -> System grades and aggregates benchmark
  -> Human reviews outputs and writes feedback
  -> Human edits skill manually
  -> Next iteration
```

V2 再加入：

```text
feedback + transcript + benchmark
  -> model proposes/applies skill changes
  -> rerun evals
  -> human review
```

## 3. MVP 范围

### 3.1 必须包含

1. Tauri 桌面应用
   - 优先支持 macOS，架构上兼容 Windows。
   - 避免 Electron 的体积和资源开销。

2. 本地 Skill Project 管理
   - 创建项目。
   - 导入 Claude-compatible skill 目录。
   - 编辑通用 skill 指令和元信息。
   - 管理 resources、evals、runs、reviews、exports。

3. Eval 资产管理
   - 创建、编辑、复制、禁用 eval case。
   - 每个 eval case 支持 prompt、expected output、input files、assertions。
   - eval 文件是项目资产，可被版本管理。

4. Agent Runtime
   - 模型可以在受控 workspace 内读写文件。
   - 支持运行脚本。
   - 支持处理 PDF、XLSX、DOCX。
   - 支持截图或浏览器验证类工具。
   - 每次运行都记录 transcript、metrics、timing、outputs。

5. with-skill 与 baseline 双跑
   - 新建 skill：baseline 是裸模型，不注入 skill。
   - 改进已有 skill：baseline 可以是旧版本 skill。
   - 两边输出统一 artifact 结构，便于 grade 和 review。

6. 自动评分与 benchmark
   - Grader 按 assertions 逐条给出 pass/fail/evidence。
   - Benchmark 聚合 pass rate、耗时、token、错误数。
   - 支持 analyzer note，指出弱断言、高波动、资源开销等。

7. 人工审核 UI
   - 展示 prompt、输入文件、输出文件、grader 证据、benchmark。
   - 支持上一轮与当前轮对比。
   - 支持逐 run 写 feedback。
   - feedback 保存为项目资产。

8. 基础导出
   - 导出 Claude-compatible `.skill`。
   - 导出通用 prompt bundle 或 model adapter bundle 的结构预留。

### 3.2 暂不包含

- 模型自动修改 skill。
- description 触发优化的完整自动循环。
- 团队账号、权限、审计。
- 远程 runner。
- 云端 benchmark 历史排行。
- 容器级隔离。
- 完整 CI 集成。

### 3.3 高级模式预留

多模型对比放在高级模式：

- MVP 默认一个 executor model、一个 grader model。
- 高级模式允许同一 eval matrix 跑多个 executor model。
- 数据模型提前支持 `model_id`、`provider`、`configuration`，但 UI 不把它作为主路径。

## 4. 技术架构

```text
Tauri Desktop Shell
  ├── Frontend App
  │   ├── Project Explorer
  │   ├── Skill Editor
  │   ├── Eval Case Manager
  │   ├── Run Monitor
  │   ├── Review Workspace
  │   └── Benchmark View
  │
  ├── Tauri Rust Backend
  │   ├── Workspace File API
  │   ├── Permission Broker
  │   ├── Process Runner
  │   ├── Artifact Indexer
  │   └── OS Integrations
  │
  ├── Core Engine
  │   ├── Project Schema
  │   ├── Eval Scheduler
  │   ├── Run Lifecycle
  │   ├── Grading Orchestrator
  │   ├── Benchmark Aggregator
  │   └── Exporters
  │
  ├── Agent Runtime
  │   ├── Tool Protocol
  │   ├── File Tools
  │   ├── Script Tools
  │   ├── Document Tools
  │   ├── Browser/Screenshot Tools
  │   └── Transcript Recorder
  │
  └── Model Adapters
      ├── Anthropic Messages Adapter
      ├── OpenAI Responses/Chat Adapter
      └── Local/Custom Adapter Hook
```

### 4.1 Tauri Desktop Shell

Tauri 负责：

- 跨平台桌面壳。
- 本地文件选择器。
- 权限确认弹窗。
- 受控进程执行。
- 打开外部文件或本地预览。
- 与前端 UI 通信。

前端负责产品体验，不直接访问任意文件系统或任意 shell。

### 4.2 Core Engine

Core Engine 是模型无关、UI 无关的业务内核。

职责：

- 解析和校验 Skill Project。
- 读取 eval set。
- 生成 run plan。
- 调度 with-skill 和 baseline。
- 收集 artifact。
- 调用 grader/analyzer/comparator。
- 聚合 benchmark。
- 管理 iteration。
- 调用 exporter。

建议实现上保持为独立包，便于未来接 CLI、Web 或 CI。

### 4.3 Agent Runtime

Agent Runtime 是 MVP 成败关键。它不是简单的 API 调用层，而是一个受控执行环境。

职责：

- 给模型暴露工具。
- 约束工具权限。
- 记录每次工具调用。
- 把所有输入输出落盘。
- 对脚本执行设置 cwd、timeout、env、输出限制。
- 对 workspace 外路径访问触发权限确认。
- 生成可审计 transcript。

MVP 不做容器级隔离，但要做 workspace 边界和权限提示。

### 4.4 Model Adapters

内部统一接口：

```ts
interface ModelAdapter {
  provider: "anthropic" | "openai" | "custom";
  call(request: ModelRequest): Promise<ModelRunResult>;
}

interface ModelRequest {
  modelId: string;
  role: "executor" | "grader" | "analyzer" | "comparator" | "description_optimizer";
  messages: RuntimeMessage[];
  tools: RuntimeToolSpec[];
  files?: RuntimeFileRef[];
  runtimeContext: RuntimeContext;
}

interface ModelRunResult {
  finalText: string;
  toolCalls: ToolCallRecord[];
  usage?: TokenUsage;
  stopReason?: string;
  rawProviderResponse?: unknown;
}
```

Anthropic 和 OpenAI 的差异留在 adapter 内部，Core Engine 只看统一结果。

## 5. Skill Project 格式

内部格式不直接锁死 Claude Skill，而是定义通用 Skill Project，再通过 exporter 兼容 Claude。

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
│   └── iteration-001/
├── reviews/
│   └── feedback.json
└── exports/
    ├── claude-skill/
    └── prompt-bundles/
```

### 5.1 skill.yaml

```yaml
schema_version: 1
id: pdf-form-helper
name: PDF Form Helper
description: Use this skill when the user needs to inspect, fill, validate, or transform PDF forms with structured fields and source data.
status: draft
created_at: "2026-06-10T00:00:00Z"
updated_at: "2026-06-10T00:00:00Z"
compatibility:
  exports:
    - claude_skill
    - prompt_bundle
runtime:
  default_executor_model:
    provider: anthropic
    model: claude-sonnet-4
  default_grader_model:
    provider: openai
    model: gpt-4.1
permissions:
  allow_workspace_read: true
  allow_workspace_write: true
  require_confirmation_for_shell: true
  require_confirmation_for_external_paths: true
```

### 5.2 instructions.md

`instructions.md` 是模型真正读取的主指令，类似 Claude Skill 的 `SKILL.md` 正文，但不包含平台绑定的 frontmatter。

导出 Claude Skill 时：

- `skill.yaml.id` -> `SKILL.md` frontmatter `name`
- `skill.yaml.description` -> `SKILL.md` frontmatter `description`
- `instructions.md` -> `SKILL.md` body
- `resources/scripts` -> `scripts`
- `resources/references` -> `references`
- `resources/assets` -> `assets`

### 5.3 evals/evals.json

建议兼容 reference schema，并加入稳定字段：

```json
{
  "schema_version": 1,
  "skill_id": "pdf-form-helper",
  "evals": [
    {
      "id": "extract-fields-basic",
      "title": "Extract fields from a PDF form",
      "enabled": true,
      "prompt": "Please inspect this PDF form and create a JSON list of all fillable fields.",
      "expected_output": "A JSON file containing field names, labels, types, and required status.",
      "files": ["evals/files/sample-form.pdf"],
      "assertions": [
        "The output includes a valid JSON file.",
        "Each field has name, label, and type.",
        "The field count matches the PDF form fields."
      ],
      "tags": ["pdf", "field-extraction"]
    }
  ]
}
```

## 6. Run 与 Iteration 结构

```text
runs/
└── iteration-001/
    ├── iteration.json
    ├── eval-extract-fields-basic/
    │   ├── eval_metadata.json
    │   ├── with_skill/
    │   │   └── run-001/
    │   │       ├── outputs/
    │   │       ├── transcript.md
    │   │       ├── metrics.json
    │   │       ├── timing.json
    │   │       └── grading.json
    │   └── baseline/
    │       └── run-001/
    │           ├── outputs/
    │           ├── transcript.md
    │           ├── metrics.json
    │           ├── timing.json
    │           └── grading.json
    ├── benchmark.json
    ├── benchmark.md
    └── analyzer-notes.json
```

### 6.1 iteration.json

```json
{
  "schema_version": 1,
  "iteration_id": "iteration-001",
  "created_at": "2026-06-10T00:00:00Z",
  "skill_version_ref": "working-tree",
  "baseline": {
    "type": "no_skill"
  },
  "executor_model": {
    "provider": "anthropic",
    "model": "claude-sonnet-4"
  },
  "grader_model": {
    "provider": "openai",
    "model": "gpt-4.1"
  },
  "evals_run": ["extract-fields-basic"],
  "status": "completed"
}
```

### 6.2 configuration 命名

MVP 中统一使用：

- `with_skill`
- `baseline`

导入 reference 资产时，可以把 `without_skill` 映射为 `baseline`，但 exporter/viewer 层要能兼容旧字段。

## 7. Agent Runtime 权限模型

MVP 采用 workspace + permission prompt，不做容器级隔离。

### 7.1 默认允许

- 读取 project workspace 内文件。
- 写入当前 run 的 `outputs/`。
- 写入 run metadata、transcript、metrics。
- 读取 skill resources。

### 7.2 需要确认

- 执行 shell 命令。
- 写入 workspace 内非 outputs 目录。
- 读取 workspace 外文件。
- 写入 workspace 外文件。
- 网络访问。
- 打开浏览器。
- 截图。
- 调用系统应用。

### 7.3 禁止或默认关闭

- 删除 workspace 外文件。
- 修改系统配置。
- 后台常驻进程无提示启动。
- 未授权读取用户 home 目录大范围内容。
- 自动上传本地文件到远程服务，除非模型 API 调用明确需要且用户确认。

### 7.4 权限记录

每次权限确认都应落到 transcript：

```json
{
  "type": "permission_decision",
  "tool": "shell.run",
  "request": {
    "command": "python scripts/extract_fields.py sample.pdf",
    "cwd": "$WORKSPACE"
  },
  "decision": "approved",
  "approved_at": "2026-06-10T00:00:00Z"
}
```

## 8. 工具协议

MVP 工具集合：

```text
file.read
file.write
file.list
file.copy_to_outputs
shell.run
document.inspect_pdf
document.inspect_xlsx
document.inspect_docx
browser.open_local
browser.screenshot
artifact.save_note
```

每个工具调用都记录：

- tool name
- input
- normalized cwd/path
- permission decision
- stdout/stderr 或 structured output
- duration
- error

这些数据汇总到 `metrics.json` 和 `transcript.md`。

## 9. Grader / Analyzer / Comparator

reference 中的三个 agent 可以直接迁移为 role prompt，但需要从 Claude Code subagent 改成通用 model call。

### 9.1 Grader

输入：

- assertions
- eval prompt
- transcript path
- outputs dir
- optional input files

输出：

```json
{
  "expectations": [
    {
      "text": "The output includes a valid JSON file.",
      "passed": true,
      "evidence": "outputs/fields.json parses successfully and contains 12 field entries."
    }
  ],
  "summary": {
    "passed": 1,
    "failed": 0,
    "total": 1,
    "pass_rate": 1.0
  },
  "claims": [],
  "eval_feedback": {
    "suggestions": [],
    "overall": "Assertions are specific enough for this run."
  }
}
```

能脚本验证的 assertion 应优先使用 deterministic checker，而不是纯模型判断。

### 9.2 Analyzer

MVP 用于 benchmark note：

- 哪些 assertion 两边都通过，区分力弱。
- 哪些 assertion 两边都失败，可能不可行或断言坏了。
- 哪些 eval 波动大。
- skill 是否显著增加耗时或 token。
- baseline 是否反而更好。

### 9.3 Comparator

MVP 可作为高级功能或隐藏能力：

- 对两个输出做盲评。
- 用于用户问“新版本是否真的更好”时。
- 多模型对比 UI 后置。

## 10. Benchmark 数据模型

兼容 reference 的 `benchmark.json` 思路，但扩展 provider/model 字段：

```json
{
  "metadata": {
    "schema_version": 1,
    "skill_id": "pdf-form-helper",
    "iteration_id": "iteration-001",
    "timestamp": "2026-06-10T00:00:00Z",
    "evals_run": ["extract-fields-basic"],
    "runs_per_configuration": 1
  },
  "runs": [
    {
      "eval_id": "extract-fields-basic",
      "configuration": "with_skill",
      "run_number": 1,
      "model": {
        "provider": "anthropic",
        "model": "claude-sonnet-4"
      },
      "result": {
        "pass_rate": 1.0,
        "passed": 3,
        "failed": 0,
        "total": 3,
        "time_seconds": 42.5,
        "tokens": 3800,
        "tool_calls": 18,
        "errors": 0
      },
      "expectations": [],
      "notes": []
    }
  ],
  "run_summary": {
    "with_skill": {},
    "baseline": {},
    "delta": {}
  },
  "notes": []
}
```

## 11. Review UI 信息架构

### 11.1 Project 页面

- Skill project 列表。
- 最近运行状态。
- 当前 iteration 摘要。
- 快捷入口：编辑 skill、管理 evals、运行 eval、review outputs。

### 11.2 Skill Editor

- `skill.yaml` 表单化编辑。
- `instructions.md` Markdown 编辑器。
- resources 文件树。
- Claude export preview。

### 11.3 Eval Manager

- eval case 列表。
- prompt 编辑。
- expected output 编辑。
- input files 管理。
- assertions 编辑。
- tags/filter。
- enabled/disabled。

### 11.4 Run Planner

- 选择 eval cases。
- 选择 executor model。
- 选择 grader model。
- baseline 类型：
  - no skill
  - previous iteration
  - selected snapshot
- runs per configuration。
- 权限策略预览。

### 11.5 Run Monitor

- with_skill / baseline 并行进度。
- 每个 eval 的状态。
- 当前工具调用。
- 权限请求弹窗。
- 失败重试入口。

### 11.6 Review Workspace

核心页面。

每个 eval 展示：

- Prompt。
- Input files。
- with_skill outputs。
- baseline outputs。
- Grader formal grades。
- Evidence。
- Previous iteration output。
- Previous feedback。
- 当前 feedback textbox。

文件预览：

- text / markdown / json / csv inline。
- image inline。
- PDF preview。
- XLSX preview。
- DOCX preview 或转换预览。
- unknown binary download/open。

### 11.7 Benchmark View

- 总体 pass rate。
- with_skill vs baseline delta。
- 时间、token、tool calls、errors。
- 按 eval 展开。
- analyzer notes。
- assertion-level breakdown。

## 12. Model Adapter 细节

### 12.1 Anthropic

需要适配：

- messages 格式。
- tool use / tool result。
- token usage。
- stop reason。
- system prompt。

Skill 注入方式：

- executor with_skill：把 `instructions.md` 和必要 resources manifest 放入 system/developer context。
- baseline：不注入 skill。

### 12.2 OpenAI

需要适配：

- Responses API 或 Chat Completions 的消息格式。
- tool calling。
- structured output。
- token usage。
- developer/system instructions。

Skill 注入方式同 Anthropic，经由内部 `RuntimeMessage` 标准化。

### 12.3 Trigger Optimization 的特殊性

reference 的 description optimization 依赖 Claude Code 的 skill trigger 机制，即：

- `.claude/commands` 注入。
- `claude -p`。
- stream event 中检测 `Skill` 或 `Read`。

通用产品里不能照搬。V2 应抽象为：

```text
TriggerDetector
  ├── ClaudeCodeTriggerDetector
  ├── PromptBundleTriggerClassifier
  └── CustomRuntimeTriggerDetector
```

MVP 不做完整 description optimization，只保留数据结构和入口。

## 13. Exporters

### 13.1 Claude Skill Exporter

输出：

```text
exports/claude-skill/<skill-id>/
├── SKILL.md
├── scripts/
├── references/
└── assets/
```

打包：

```text
exports/claude-skill/<skill-id>.skill
```

排除：

- evals/
- runs/
- reviews/
- exports/
- node_modules/
- __pycache__/
- .DS_Store
- *.pyc

### 13.2 Prompt Bundle Exporter

输出给非 Claude Skill runtime：

```text
exports/prompt-bundles/<skill-id>/
├── system.md
├── developer.md
├── resources-manifest.json
└── tool-policy.json
```

用于 Anthropic/OpenAI adapter 注入。

## 14. Reference 资产迁移计划

### 14.1 可直接迁移或改写较少

- `references/schemas.md`
  - 作为初版数据模型参考。
- `agents/grader.md`
  - 改造成通用 grader role prompt。
- `agents/comparator.md`
  - 改造成通用 blind comparator role prompt。
- `agents/analyzer.md`
  - 拆成 benchmark analyzer 与 post-hoc analyzer 两个 role prompt。
- `scripts/aggregate_benchmark.py`
  - 逻辑可迁移到 Core Engine。
- `scripts/quick_validate.py`
  - 改造成通用 project validator 和 Claude exporter validator。
- `scripts/package_skill.py`
  - 改造成 Claude Skill Exporter。
- `eval-viewer/viewer.html`
  - 交互模型可复用，但 UI 应重做成桌面端 review workspace。

### 14.2 需要重写为 adapter

- `scripts/run_eval.py`
  - 当前强绑定 `claude -p` 和 `.claude/commands`。
  - MVP 不迁移触发检测；V2 做 TriggerDetector。

- `scripts/run_loop.py`
  - 当前专注 description optimization。
  - V2 改造成通用 optimization workflow。

- `scripts/improve_description.py`
  - 当前调用 `claude -p`。
  - V2 改造成 model adapter 调用。

- `assets/eval_review.html`
  - 可保留思路，但应并入桌面 eval manager。

## 15. MVP 实施里程碑

### Milestone 1: Project + Eval Assets

- 创建 Tauri app skeleton。
- 实现 Skill Project schema。
- 实现 project open/create/import。
- 实现 eval case CRUD。
- 实现 input files 管理。
- 实现 project validator。

验收：

- 能创建一个 skill project。
- 能写 instructions。
- 能创建 evals/evals.json。
- 能导入 input files。

### Milestone 2: Runtime + Single Run

- 实现 model adapter 基础接口。
- 实现 workspace file tools。
- 实现 shell.run 权限提示。
- 实现 transcript/metrics/timing。
- 实现单个 eval 的 with_skill run。

验收：

- 模型能在 workspace 内完成一个文件型任务。
- outputs、transcript、metrics、timing 全部落盘。

### Milestone 3: Baseline + Grading

- 实现 baseline run。
- 实现 run planner。
- 实现 grader role。
- 实现 grading.json。
- 实现 deterministic checker 插槽。

验收：

- 同一 eval 能生成 with_skill 与 baseline 两组结果。
- 两组结果都能被 grader 评分。

### Milestone 4: Benchmark + Review UI

- 实现 benchmark aggregation。
- 实现 review workspace。
- 实现文件预览。
- 实现 feedback 保存。
- 实现 previous iteration 对比。

验收：

- 开发者能完整审查一次 iteration。
- feedback 作为资产保存。
- benchmark 可用于判断 skill 是否有增量价值。

### Milestone 5: Export

- 实现 Claude Skill exporter。
- 实现 `.skill` package。
- 实现 prompt bundle exporter 初版。

验收：

- 通用 Skill Project 可导出为 Claude-compatible skill。
- 导出的 `.skill` 不包含 evals/runs/reviews。

## 16. V2 重点能力

V2 的中心是模型自动修改 skill。

### 16.1 Auto Improve Workflow

```text
Load feedback.json
  -> Load benchmark.json
  -> Load failed transcripts and outputs
  -> Summarize patterns
  -> Propose generalized skill changes
  -> Apply changes to instructions/resources
  -> Create new skill snapshot
  -> Run next iteration
```

### 16.2 修改策略

模型不能只 patch 某个 eval 的表面失败，而要遵守：

- 从反馈泛化。
- 避免过拟合。
- 解释为什么。
- 删除无效指令。
- 把重复劳动沉淀为 scripts。
- 改完必须能 diff 和回滚。

### 16.3 Human Approval

V2 自动改写仍需人审：

- 展示 proposed diff。
- 允许 accept/reject/edit。
- accept 后进入下一轮 eval。

## 17. 关键风险

1. Runtime 安全边界
   - 不做容器并不等于不做安全。
   - 权限提示、路径归一化、命令 timeout、外部路径限制必须从 MVP 开始做。

2. Grader 可信度
   - 纯模型评分容易产生假信心。
   - 能脚本验证的 assertion 应支持 checker。
   - Grader 必须给 evidence。

3. 文件预览复杂度
   - PDF/XLSX/DOCX 预览是 review 体验核心。
   - 可以先支持基础预览，再逐步增强。

4. 多 provider 工具语义差异
   - Anthropic 和 OpenAI 的 tool calling 不完全一致。
   - 内部工具协议必须稳定，adapter 做转换。

5. Skill 格式泛化
   - 通用 Project 不应丢失 Claude Skill 的 progressive disclosure 优点。
   - exporter 必须保证导出结果可用。

## 18. 当前建议决策

建议采用：

- 桌面端：Tauri。
- 安全模型：workspace + permission prompt。
- MVP 核心：eval 资产管理 + 人工审核体验。
- 必跑模式：with_skill + baseline。
- 多模型对比：高级模式预留。
- Skill 格式：内部通用 Project，导出兼容 Claude Skill。
- V2 重点：模型自动修改 skill 和完整闭环。


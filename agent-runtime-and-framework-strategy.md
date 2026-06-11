# Agent Runtime and Framework Strategy

## 1. 为什么需要 Agent Runtime

Skill Studio 的核心不是让模型“回复一段话”，而是让模型在一个受控 workspace 中完成可评测、可复现、可审核的工程任务。

因此，Agent Runtime 的作用是把模型从普通消息接口扩展成一个可以使用工具、读写文件、运行脚本、处理文档、记录证据并生成 artifacts 的执行主体。

它处在 Core Engine 和 Model Adapter 之间：

```text
Core Engine
  -> Agent Runtime
      -> Model Adapter
      -> Tools
      -> Permission Broker
      -> Artifact Recorder
```

Core Engine 关心的是 eval/run/review/benchmark 生命周期；Model Adapter 关心的是 Anthropic、OpenAI 或其他模型 API 的消息格式；Agent Runtime 则负责把一次模型执行变成一个完整、可审计的 run。

## 2. Agent Runtime 的职责

### 2.1 工具暴露

Runtime 需要向模型暴露稳定的内部工具协议，例如：

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

这些工具不应该直接等同于某个模型厂商的 tool calling 格式。内部工具协议应保持稳定，Anthropic/OpenAI 的差异由 Model Adapter 负责转换。

### 2.2 权限控制

MVP 使用 workspace + permission prompt，而不是容器级隔离。

默认允许：

- 读取 project workspace 内文件。
- 写入当前 run 的 `outputs/`。
- 读取 skill resources。
- 写入 run metadata、transcript、metrics、timing。

需要确认：

- 执行 shell 命令。
- 写入 workspace 内非 outputs 目录。
- 读取 workspace 外文件。
- 写入 workspace 外文件。
- 网络访问。
- 打开浏览器。
- 截图。
- 调用系统应用。

默认禁止或关闭：

- 删除 workspace 外文件。
- 修改系统配置。
- 无提示启动后台常驻进程。
- 大范围扫描用户 home 目录。
- 未授权上传本地文件。

每次权限请求和决策都应写入 transcript，形成可审计证据：

```json
{
  "type": "permission_decision",
  "tool": "shell.run",
  "request": {
    "command": "python scripts/extract_fields.py sample.pdf",
    "cwd": "$WORKSPACE"
  },
  "decision": "approved",
  "approved_at": "2026-06-11T00:00:00Z"
}
```

### 2.3 执行管理

Runtime 要负责工具调用的实际执行约束：

- 规范化 cwd。
- 限制可访问路径。
- 设置命令 timeout。
- 控制 env。
- 捕获 stdout/stderr。
- 处理中断和失败。
- 限制输出大小。
- 把生成文件收集到 `outputs/`。

这部分不能完全交给 agent 框架，因为它关系到桌面应用的安全边界和 review 资产的可靠性。

### 2.4 记录与证据

每次 run 必须产生稳定 artifacts：

```text
run-001/
├── outputs/
├── transcript.md
├── metrics.json
├── timing.json
└── grading.json
```

其中：

- `outputs/` 是模型最终产物。
- `transcript.md` 是执行过程证据。
- `metrics.json` 记录工具调用、错误数、输出大小等。
- `timing.json` 记录耗时和 token usage。
- `grading.json` 由 grader 后续生成。

这些 artifacts 是 review UI、benchmark、V2 自动改进的基础。

### 2.5 Run 生命周期

Runtime 还要支持 Skill Studio 的评测模式：

```text
eval case
  -> with_skill run
  -> baseline run
  -> artifact collection
  -> grader run
  -> benchmark aggregation
  -> human review
```

这意味着 Runtime 不只是“让 agent 跑起来”，还要服从 Core Engine 的 run plan。

## 3. Agent Runtime 不等于 Model Adapter

Model Adapter 只解决模型 API 差异。

例如：

- Anthropic Messages API 的 tool use 格式。
- OpenAI Responses/Chat API 的 tool calling 格式。
- 不同 provider 的 token usage 字段。
- 不同 provider 的 stop reason。
- system/developer/user message 的转换。

Agent Runtime 解决的是执行环境问题：

- 模型能用哪些工具。
- 工具怎么执行。
- 权限如何拦截。
- 文件如何落盘。
- transcript 如何记录。
- artifacts 如何被后续 grader 和 review UI 使用。

二者应该解耦。

## 4. Agent Runtime 不等于 Agent 框架

DeepAgents、LangGraph、AutoGen、CrewAI 这类框架主要解决 agent orchestration 问题，例如：

- 多步规划。
- tool use loop。
- 子任务拆解。
- 多 agent 协作。
- state 管理。
- memory。
- 长任务调度。

这些能力有价值，但它们通常不会完整解决 Skill Studio 需要的产品级 runtime 问题：

- workspace 权限边界。
- 桌面权限提示。
- shell 执行安全策略。
- run artifact 目录规范。
- deterministic metrics。
- `with_skill` / `baseline` 双跑生命周期。
- review UI 所需的稳定数据结构。
- benchmark 聚合输入格式。

因此，agent 框架可以成为 Runtime 的一个组件，但不应该直接等同于 Runtime。

## 5. DeepAgents 可以怎么用

如果使用 DeepAgents，它更适合放在 Agent Runtime 内部，作为 orchestration backend：

```text
Agent Runtime
  ├── Runtime Interface
  ├── Permission Broker
  ├── Tool Registry
  ├── Artifact Recorder
  ├── Model Adapters
  └── Orchestration Backend
      ├── Native Loop
      ├── DeepAgents
      └── LangGraph
```

DeepAgents 可以负责：

- executor 的多步 tool loop。
- grader/analyzer/comparator 的 role execution。
- 复杂任务的子任务拆分。
- 长上下文和状态管理。
- 多 agent 协作实验。

Skill Studio 仍然应该自己负责：

- 工具协议定义。
- 工具权限检查。
- 文件系统边界。
- shell 命令执行。
- artifact 写入。
- transcript 格式。
- eval/run/iteration 结构。
- benchmark schema。
- review feedback schema。

## 6. 推荐的可插拔 Runtime 接口

不要把某个框架写死成唯一实现。建议定义自己的 Runtime 接口：

```ts
interface AgentRuntime {
  run(request: AgentRunRequest): Promise<AgentRunResult>;
}

interface AgentRunRequest {
  projectPath: string;
  runDir: string;
  role: "executor" | "grader" | "analyzer" | "comparator" | "description_optimizer";
  mode: "with_skill" | "baseline";
  prompt: string;
  skillContext?: SkillContext;
  inputFiles: RuntimeFileRef[];
  tools: RuntimeToolSpec[];
  model: ModelConfig;
  permissionPolicy: PermissionPolicy;
}

interface AgentRunResult {
  status: "completed" | "failed" | "cancelled";
  finalText: string;
  outputs: RuntimeFileRef[];
  transcriptPath: string;
  metricsPath: string;
  timingPath: string;
  usage?: TokenUsage;
  error?: RuntimeError;
}
```

然后实现多个 backend：

```text
NativeAgentRuntime
DeepAgentsRuntime
LangGraphRuntime
ClaudeCodeRuntime
```

### 6.1 NativeAgentRuntime

MVP 默认实现。

特点：

- 简单。
- 可控。
- 少依赖。
- 容易调试。
- 权限和 artifact 逻辑完全掌握在产品内。

适合先跑通：

- with_skill/baseline。
- eval execution。
- grader。
- benchmark。
- review UI。

### 6.2 DeepAgentsRuntime

作为高级或实验 backend。

适合：

- 更复杂的多步任务。
- 需要子任务规划的 skill。
- 多 agent evaluator。
- V2 自动改写 skill。

但必须通过 Skill Studio 的 Tool Registry 和 Permission Broker 使用工具，不能绕过 runtime 直接访问文件系统或 shell。

### 6.3 LangGraphRuntime

适合需要明确状态机和可视化流程的场景：

- executor -> verifier -> fixer。
- grader -> analyzer -> benchmark note。
- auto-improve loop。

### 6.4 ClaudeCodeRuntime

用于兼容 reference 工作流或本地 Claude Code 用户：

- 可以复用 `claude -p`。
- 可以复用现有 `.claude/commands` 触发检测。
- 但它应该是 adapter，不是产品核心依赖。

## 7. MVP 建议

MVP 不建议一开始就押注 DeepAgents 作为唯一 runtime。

更稳的路径：

1. 先实现最小 NativeAgentRuntime。
2. 固定 Tool Protocol。
3. 固定 Artifact Schema。
4. 跑通 with_skill + baseline。
5. 跑通 grader + benchmark。
6. 跑通 review UI。
7. 再把 DeepAgents 接成第二个 backend。

这样做的原因是：

- MVP 的最大风险不是 agent 会不会规划，而是 runtime 资产链路是否稳定。
- Review UI 和 benchmark 依赖稳定 artifacts。
- 权限模型必须由产品控制。
- 框架可以替换，但项目格式和运行记录不能频繁变化。

## 8. DeepAgents 接入时的边界要求

如果后续接 DeepAgents，应满足以下约束：

1. DeepAgents 只能通过 Skill Studio 注册的工具访问系统能力。
2. 所有工具调用必须进入 transcript。
3. 所有文件写入必须经过 workspace path resolver。
4. shell 命令必须经过 Permission Broker。
5. provider API 调用必须经过 Model Adapter。
6. run 结束必须产出标准 `AgentRunResult`。
7. 失败、取消、超时必须有结构化状态。
8. 不能让 DeepAgents 自己定义独立 artifact 结构。

换句话说，DeepAgents 是执行策略，不是产品数据模型。

## 9. 与 V2 自动改进的关系

V2 的模型自动修改 skill 会更需要强 orchestration：

```text
load feedback
  -> inspect failed outputs
  -> inspect transcripts
  -> identify generalizable issues
  -> propose diff
  -> apply or request approval
  -> rerun evals
```

这类流程更适合 DeepAgents 或 LangGraph 这样的框架，因为它不只是一次 executor run，而是多个角色和多个状态的循环。

但即使在 V2，也建议保持同样原则：

- Auto improver 可以由 DeepAgents 编排。
- 文件修改必须通过 Runtime 工具。
- diff 必须可审。
- 新 iteration 必须走同一套 eval/run/review/benchmark 资产链路。

## 10. 结论

Agent Runtime 的本质是 Skill Studio 的本地执行环境。它负责把模型调用、工具执行、权限控制、文件产物、运行记录和评测生命周期连接起来。

DeepAgents 这类框架可以帮助实现 Runtime 内部的 agent orchestration，但不能替代完整 Runtime。最合理的架构是：

```text
Skill Studio owns:
  project schema
  tool protocol
  permission model
  artifact schema
  run lifecycle
  review/benchmark contracts

DeepAgents may own:
  planning
  multi-step execution
  agent role orchestration
  stateful task solving
```

因此，推荐 MVP 先做一个简单、可控、产品自有的 NativeAgentRuntime，并把 DeepAgents 设计成可插拔 backend。这样既能快速落地，又不会被某个 agent 框架锁死。


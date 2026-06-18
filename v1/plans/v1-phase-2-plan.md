# V1 Phase 2 Plan: Minimal NativeAgentRuntime with Anthropic

## 1. Phase 2 目标

Phase 2 的目标是实现一个不依赖 desktop UI 的最小 NativeAgentRuntime，让真实 Anthropic 模型可以在受控 workspace 中完成一个文件型任务，并把运行结果写入 Phase 1 定义的 run artifact 结构。

Phase 2 的成功标准不是“完整 agent 平台”，而是：

```text
prompt + workspace + run artifact paths
  -> Anthropic model uses tools
  -> reads fixture input file
  -> writes outputs/summary.json
  -> records transcript/metrics/timing
```

## 2. Phase 2 非目标

Phase 2 不做以下事情：

- 不实现 OpenAI adapter。
- 不实现 baseline 双跑。
- 不实现 with-skill prompt injection 的完整策略。
- 不实现 grader。
- 不实现 benchmark。
- 不实现 review UI。
- 不实现 Tauri permission prompt。
- 不实现 DeepAgents/LangGraph backend。
- 不实现 PDF/XLSX/DOCX 工具。
- 不实现 `.skill` 导出。

Phase 2 只做最小真实 executor path：NativeAgentRuntime + Anthropic adapter + 本地工具 + artifact recorder。

## 3. 开发原则

1. Runtime 必须写入 Phase 1 定义的 artifact paths，不另起输出结构。
2. Anthropic 是首个真实 provider，但不能污染 runtime 的 provider-neutral 接口。
3. 所有工具调用必须进入 transcript。
4. 所有文件读写必须经过 workspace path resolver。
5. `shell.run` 必须经过 permission policy stub。
6. Phase 2 先追求单 eval/single run 可用，不做并发和复杂 orchestration。
7. 运行入口必须 headless，可通过 CLI 或 test harness 触发。

## 4. Runtime MVP 工具

Phase 2 实现以下工具。

### 4.1 file.list

用途：

- 列出 workspace 内目录。

约束：

- 输入 path 必须在 workspace root 内。
- 默认不递归或限制最大深度。
- 输出相对路径列表。

### 4.2 file.read

用途：

- 读取 workspace 内文本文件。

约束：

- 输入 path 必须在 workspace root 内。
- Phase 2 只支持 text-like files。
- 大文件需要截断或返回可读错误。

### 4.3 file.write

用途：

- 写入 workspace 内文件。

约束：

- 默认只允许写入当前 run 的 `outputs/`。
- 写入其他 workspace 路径需要 permission policy stub 决策。
- 必须创建父目录。

### 4.4 shell.run

用途：

- 执行简单 shell 命令。

约束：

- 必须经过 permission policy stub。
- cwd 必须在 workspace root 内。
- 必须设置 timeout。
- 捕获 stdout/stderr/exit code。
- Phase 2 不支持后台常驻命令。

### 4.5 artifact.save_note

用途：

- 允许 executor 保存备注、假设、不确定项或待人工审核事项。

输出：

- 写入 `outputs/user_notes.md` 或 transcript 中的 note event。

## 5. Runtime 基础能力

### 5.1 Workspace Path Resolver

职责：

- 将模型传入的相对路径解析为绝对路径。
- 阻止 `..` path traversal。
- 阻止 symlink 或 realpath 逃逸 workspace root。
- 区分 project root、run dir、outputs dir。

验收：

- `evals/files/notes.txt` 可读。
- `../outside.txt` 被拒绝。
- 绝对路径默认被拒绝，除非后续 permission policy 明确允许。

### 5.2 Tool Registry

职责：

- 注册内部工具定义。
- 给 model adapter 暴露 provider-neutral tool specs。
- 将 provider tool call 路由到本地工具实现。

Phase 2 工具注册：

```text
file.list
file.read
file.write
shell.run
artifact.save_note
```

### 5.3 Tool Dispatch Loop

职责：

- 接收 Anthropic 返回的 tool use。
- 调用本地工具。
- 将 tool result 返回给 Anthropic。
- 循环直到模型结束。

Phase 2 限制：

- 单 run 最大 tool round 数可配置，默认较小。
- 工具失败时返回结构化错误给模型。
- runtime 最终仍要记录失败状态。

### 5.4 Permission Policy Stub

职责：

- Phase 2 先不接 Tauri UI，但不能绕过权限边界。

建议策略：

- `file.read` workspace 内允许。
- `file.write` outputs 内允许。
- `shell.run` 默认需要显式 allow flag 或 CLI confirm。
- workspace 外路径全部拒绝。

每次 permission decision 写入 transcript。

### 5.5 Transcript Recorder

职责：

- 记录 run 输入、模型消息、工具请求、工具结果、权限决策、最终输出和错误。

Phase 2 输出：

```text
transcript.md
```

最低要求：

- 可读。
- 能作为后续 grader 输入。
- 包含 tool call evidence。

### 5.6 Metrics Recorder

职责：

- 记录工具调用数量、错误数量、输出文件、stdout/stderr size 等。

Phase 2 输出：

```text
metrics.json
```

最低字段：

```json
{
  "tool_calls": {},
  "total_tool_calls": 0,
  "total_steps": 0,
  "files_created": [],
  "errors_encountered": 0,
  "output_chars": 0,
  "transcript_chars": 0
}
```

### 5.7 Timing Recorder

职责：

- 记录 run 开始/结束时间、耗时、provider usage。

Phase 2 输出：

```text
timing.json
```

最低字段：

```json
{
  "executor_start": "2026-06-18T00:00:00Z",
  "executor_end": "2026-06-18T00:00:10Z",
  "executor_duration_seconds": 10.0,
  "total_duration_seconds": 10.0,
  "total_tokens": 0
}
```

## 6. Anthropic 最小接入

### 6.1 环境变量

Phase 2 使用：

```text
ANTHROPIC_API_KEY
```

如果未设置：

- integration test 应 skip 或给出清晰错误。
- runtime 不应静默失败。

### 6.2 Provider-neutral ModelAdapter

`packages/model-adapters` 暴露统一接口：

```ts
interface ModelAdapter {
  call(request: ModelRequest): Promise<ModelRunResult>;
}
```

Phase 2 只实现 Anthropic adapter，但接口必须允许后续添加 OpenAI。

### 6.3 Anthropic Tool-call Loop

Phase 2 的 adapter 需要支持：

- 发送 system/user messages。
- 发送 tool definitions。
- 接收 tool use。
- 返回 tool result。
- 读取 usage。
- 读取 stop reason。

不要求：

- streaming。
- cache。
- multimodal input。
- parallel tool call。
- advanced retries。

### 6.4 Executor Prompt

Phase 2 可以使用最小 executor prompt：

```text
You are running inside Skill Studio's controlled workspace.
Use the provided tools to inspect input files and create the requested output files.
Save final artifacts under the run outputs directory.
Do not claim a file was created unless you actually wrote it with file.write.
```

完整 with-skill prompt injection 留到 Phase 3。

## 7. AgentRuntime 接口

Phase 2 完成以下接口：

```ts
interface AgentRuntime {
  run(request: AgentRunRequest): Promise<AgentRunResult>;
}

interface AgentRunRequest {
  projectPath: string;
  runDir: string;
  outputsDir: string;
  role: "executor";
  mode: "with_skill" | "baseline";
  prompt: string;
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

Phase 2 只实现 `role: "executor"`。Grader/analyzer/comparator 留到后续 phase。

## 8. Phase 2 任务拆分

### Task 2.1: 完成 runtime/model interfaces

交付物：

- `AgentRuntime`
- `AgentRunRequest`
- `AgentRunResult`
- `RuntimeToolSpec`
- `ToolCallRecord`
- `PermissionPolicy`
- `ModelAdapter`
- `ModelRequest`
- `ModelRunResult`

验收：

- 接口不依赖 desktop UI。
- 接口可以表达 outputs dir、workspace、model、tools 和 permission policy。

### Task 2.2: 实现 workspace path resolver

交付物：

- path resolve helper。
- project root/run dir/outputs dir boundary checks。

验收：

- workspace 内相对路径通过。
- `..` 逃逸失败。
- workspace 外绝对路径失败。
- outputs 写入路径通过。

### Task 2.3: 实现工具注册与本地工具

交付物：

- tool registry。
- `file.list`
- `file.read`
- `file.write`
- `shell.run`
- `artifact.save_note`

验收：

- 每个工具可被直接单元测试。
- 工具返回 structured result。
- 工具错误返回 structured error。

### Task 2.4: 实现 recorder

交付物：

- transcript recorder。
- metrics recorder。
- timing recorder。

验收：

- 每次工具调用写入 transcript。
- metrics 统计 tool calls。
- timing 记录 start/end/duration。
- run 失败时仍写入可读 artifacts。

### Task 2.5: 实现 Anthropic adapter

交付物：

- Anthropic client wrapper。
- provider-neutral tool spec -> Anthropic tool schema 转换。
- Anthropic tool use -> internal tool call 转换。
- tool result -> Anthropic message 转换。

验收：

- `ANTHROPIC_API_KEY` 存在时可真实调用模型。
- 未设置 key 时给出明确错误或 skip integration test。
- usage 能写入 timing/metrics。

### Task 2.6: 实现 NativeAgentRuntime

交付物：

- runtime orchestration。
- tool dispatch loop。
- permission policy stub。
- final artifact writing。

验收：

- runtime 能驱动 Anthropic 模型调用 file tools。
- runtime 能将结果写入 Phase 1 的 run dir。
- runtime 能返回 `AgentRunResult`。

### Task 2.7: 实现 CLI 或 test harness

交付物：

- 一个 headless 入口，用于运行 sample eval。

输入：

- project path。
- eval id。
- run dir。
- model id。

验收：

- 无 desktop UI 也能触发单个 eval run。
- 生成标准 artifacts。

## 9. Test Plan

### 9.1 Unit tests

- workspace path resolver blocks path escape。
- workspace path resolver accepts fixture input file。
- file tools read/write only inside workspace。
- `file.write` writes under outputs dir。
- `shell.run` calls permission policy stub。
- metrics count tool calls。
- transcript records tool requests/results。
- timing records start/end/duration。

### 9.2 Integration tests

需要 `ANTHROPIC_API_KEY`。

- Anthropic-backed executor can complete sample file transform。
- Model reads `evals/files/notes.txt`。
- Model writes `outputs/summary.json`。
- `outputs/summary.json` contains parseable JSON。
- `transcript.md` includes tool call evidence。
- `metrics.json` includes created file。
- `timing.json` includes duration and provider usage when available。

如果未设置 `ANTHROPIC_API_KEY`：

- integration tests skip。
- unit tests 仍可运行。

### 9.3 Manual smoke

运行一个 sample eval，不启动 desktop UI。

人工检查：

- run directory 存在。
- `outputs/summary.json` 存在。
- `transcript.md` 可读。
- `metrics.json` 有 tool call counts。
- `timing.json` 有 duration。

## 10. Phase 2 验收标准

Phase 2 完成时，应该能够做到：

```text
load sample project artifact paths from Phase 1
  -> create AgentRunRequest
  -> call NativeAgentRuntime
  -> Anthropic model uses file tools
  -> model reads fixture input file
  -> model writes outputs/summary.json
  -> runtime writes transcript/metrics/timing
  -> returns AgentRunResult
```

明确验收：

- 输入一个 prompt 和 workspace，真实 Anthropic 模型能调用工具。
- 模型能读取 fixture input file。
- 模型能写入 `outputs/summary.json`。
- `transcript.md`、`metrics.json`、`timing.json` 均落盘。
- `shell.run` 走 permission policy stub。
- 无 desktop UI 也能通过 CLI/test harness 跑通。

## 11. 风险与检查点

### 11.1 Provider 耦合进 Runtime

风险：

- NativeAgentRuntime 直接依赖 Anthropic message shape，后续 OpenAI adapter 难接。

控制：

- Anthropic 细节只出现在 `packages/model-adapters`。
- Runtime 只看 provider-neutral `ModelAdapter`。

### 11.2 Tool 权限被绕过

风险：

- 工具实现直接读写文件或执行 shell，绕过 policy。

控制：

- 所有工具都必须通过 workspace path resolver 和 permission policy。

### 11.3 Artifact 与 Phase 1 不一致

风险：

- Runtime 临时写自己的 transcript/metrics/timing 格式。

控制：

- Phase 2 artifact writer 必须使用 Phase 1 定义的 paths 和最低字段。

### 11.4 真实模型测试不稳定

风险：

- Anthropic integration test 受网络、key、模型行为影响。

控制：

- Unit tests 不依赖真实模型。
- Integration tests 在缺少 key 时 skip。
- Manual smoke 作为真实 provider 验证。

### 11.5 Shell 工具过早扩大权限

风险：

- `shell.run` 变成不受控的本机执行入口。

控制：

- Phase 2 默认只允许显式确认或 allow flag。
- 禁止后台常驻命令。
- cwd 必须在 workspace 内。
- 必须设置 timeout。

## 12. 推荐完成顺序

```text
1. runtime/model interfaces
2. workspace path resolver
3. local tool implementations
4. transcript/metrics/timing recorders
5. Anthropic adapter
6. NativeAgentRuntime orchestration
7. CLI/test harness for sample eval
8. integration smoke with ANTHROPIC_API_KEY
```

这个顺序可以先把安全边界和 artifact 记录打牢，再接真实模型，避免模型调用先跑起来但输出无法审计。


# V1 Development Routine

## 1. 核心判断

V1 不应该先做一个完整 desktop app 空壳，也不应该先做一个完全脱离 skill eval 场景的通用 agent runtime。

更稳的开发顺序是先实现一个 **skill-eval-oriented headless vertical slice**：

```text
schemas/artifacts
  -> headless NativeAgentRuntime
  -> with_skill + baseline
  -> grader + benchmark
  -> Tauri desktop shell
  -> review UI polish
  -> exporters
```

这样可以最早验证 V1 的核心风险：

- 模型能否在受控 workspace 中完成文件型任务。
- 工具调用、权限、transcript、metrics、timing 是否能稳定落盘。
- with-skill 与 baseline 是否能形成可对比结果。
- grader 和 benchmark 是否能为人工审核提供足够证据。

等这个闭环跑通后，再接 Tauri UI。这样 desktop app 接入的是已经有真实行为的 core/runtime，而不是空界面。

## 2. 开发原则

1. 先固定 artifact contract，再做 UI。
2. 先做最小 NativeAgentRuntime，不先绑定 DeepAgents。
3. Runtime 必须围绕 skill eval 场景实现，不做过度通用化。
4. with-skill 与 baseline 是 V1 必备路径，不是后置功能。
5. Review UI 是 V1 最重要的产品体验，但它依赖前面的 artifacts。
6. 多模型对比预留数据结构，V1 不作为主路径。
7. V2 自动修改 skill 需要的数据要从 V1 开始沉淀。

## 3. Phase 0: 工程骨架

### 目标

建立 monorepo 或等价工程结构，让 core、runtime、model adapter、desktop app 可以独立演进。

### 建议结构

```text
apps/
  desktop/              # Tauri app
packages/
  core/                 # project/eval/run/benchmark 业务内核
  runtime/              # NativeAgentRuntime
  model-adapters/       # OpenAI/Anthropic
  schemas/              # shared types + validators
  document-tools/       # pdf/xlsx/docx helpers
```

### 工作项

- 初始化 repo package 结构。
- 配置 TypeScript/Rust/Python 的实际边界。
- 确定 shared schema 的语言和校验方式。
- 建立 fixtures 目录，用于 sample skill project 和 sample eval。
- 配置基础测试命令。

### 验收标准

- 能运行基础 test/lint/typecheck。
- 各 package 可以相互引用。
- 有一个 sample skill project fixture。
- 后续 phase 可以在不启动 desktop UI 的情况下测试 core/runtime。

## 4. Phase 1: 数据模型与 Artifact Contract

### 目标

先固定 Skill Studio 的核心资产格式，避免后续 runtime、grader、review UI 各自生成不兼容结构。

### 必须定义

- Skill Project schema。
- `skill.yaml`。
- `instructions.md`。
- `evals/evals.json`。
- `iteration.json`。
- run directory structure。
- `transcript.md`。
- `metrics.json`。
- `timing.json`。
- `grading.json`。
- `benchmark.json`。
- `feedback.json`。

### 目录结构

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
└── exports/
```

### Run 结构

```text
runs/
└── iteration-001/
    ├── iteration.json
    ├── eval-example/
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

### 工作项

- 实现 schema validators。
- 实现 project loader。
- 实现 eval set loader。
- 实现 iteration/run path builder。
- 实现 artifact writer。
- 实现 sample fixture。

### 验收标准

- 能创建一个 sample skill project。
- 能加载 `evals/evals.json`。
- 能生成 iteration/run 目录。
- 能写入标准 artifact 文件。
- schema 校验能报出可读错误。

## 5. Phase 2: 最小 NativeAgentRuntime

### 目标

实现一个不依赖完整 desktop UI 的最小本地 agent runtime，让模型可以在 workspace 内执行一个文件型任务。

### MVP 工具

```text
file.read
file.write
file.list
shell.run
artifact.save_note
```

### Runtime 能力

- workspace path resolver。
- tool dispatch loop。
- transcript recorder。
- metrics recorder。
- timing recorder。
- command timeout。
- stdout/stderr capture。
- permission policy stub。

一开始 permission prompt 可以先用命令行确认，后续再接 Tauri 弹窗。

### 工作项

- 定义 `AgentRuntime` 接口。
- 定义 `AgentRunRequest`。
- 定义 `AgentRunResult`。
- 实现 NativeAgentRuntime。
- 实现工具注册表。
- 实现工具调用记录。
- 实现 outputs 写入。

### 验收标准

- 给 runtime 一个 prompt，runtime 能调用模型。
- 模型能调用 file/shell 工具。
- 结果写入 `outputs/`。
- `transcript.md`、`metrics.json`、`timing.json` 全部落盘。
- runtime 可以在无 desktop UI 环境下通过 CLI 或测试运行。

## 6. Phase 3: with-skill + baseline 双跑

### 目标

让同一个 eval case 可以生成 with-skill 与 baseline 两组结果。

### 模式

```text
with_skill:
  注入 instructions.md + resources manifest

baseline:
  不注入 skill
```

后续改进已有 skill 时，baseline 可以扩展为 previous iteration 或 selected snapshot。

### 工作项

- 实现 run planner。
- 实现 with-skill prompt/context builder。
- 实现 baseline prompt/context builder。
- 实现 eval case -> run request 转换。
- 实现同一 eval 的两组 run 输出。
- 实现 run status tracking。

### 验收标准

同一个 eval case 可以生成：

```text
runs/iteration-001/eval-xxx/with_skill/run-001/
runs/iteration-001/eval-xxx/baseline/run-001/
```

两边都包含：

- `outputs/`
- `transcript.md`
- `metrics.json`
- `timing.json`

## 7. Phase 4: Model Adapter

### 目标

先接一个模型 provider，但内部接口提前保持 provider-neutral。

### 建议

V1 可以先接 Anthropic 或 OpenAI 中的一个。不要让 Core Engine 直接依赖任何 provider 的原生消息格式。

### 内部接口

```ts
interface ModelAdapter {
  call(request: ModelRequest): Promise<ModelRunResult>;
}
```

### 工作项

- 定义 provider-neutral message。
- 定义 provider-neutral tool spec。
- 定义 provider-neutral tool result。
- 实现第一个 provider adapter。
- 记录 token usage。
- 处理 stop reason。
- 处理 tool call roundtrip。

### 验收标准

- NativeAgentRuntime 不知道底层是 OpenAI 还是 Anthropic。
- 工具调用能被 adapter 正常转换。
- usage 能写入 timing/metrics。
- 后续能添加第二个 provider，不需要改 Core Engine。

## 8. Phase 5: Grader + Benchmark

### 目标

对 with-skill 和 baseline 两组输出进行自动评分，并聚合成 benchmark。

### Grader 输入

- eval prompt。
- assertions。
- transcript path。
- outputs dir。
- optional input files。

### Grader 输出

```text
grading.json
```

### Benchmark 输出

```text
benchmark.json
benchmark.md
```

### 工作项

- 迁移/改写 reference 中的 grader prompt。
- 实现 grader run。
- 实现 `grading.json` writer。
- 实现 benchmark aggregator。
- 实现 analyzer notes 的数据槽位。
- 预留 deterministic checker 插槽。

### 验收标准

- with-skill 和 baseline 都能被评分。
- 每条 assertion 都有 pass/fail/evidence。
- benchmark 能展示 pass rate、time、token、delta。
- benchmark schema 能被后续 Review UI 直接消费。

## 9. Phase 6: Tauri Desktop Shell

### 目标

在 headless 闭环跑通后，再接 desktop UI。此时桌面端不是空壳，而是对已有 core/runtime 的可视化入口。

### 第一版页面

- Open Project。
- Project Explorer。
- Skill Editor。
- Eval Case Manager。
- Run Planner。
- Run Monitor。
- Review Workspace。
- Benchmark View。

### 工作项

- 初始化 Tauri app。
- 接入 project open/create。
- 接入 core project loader。
- 接入 eval list。
- 接入 run planner。
- 接入 runtime 调用。
- 接入 run status。
- 接入 artifact viewer。

### 验收标准

- 用户可以在桌面端打开项目。
- 用户可以选择 eval。
- 用户可以点击 run。
- 系统生成 with-skill/baseline 结果。
- 用户可以进入 review 页面查看结果。

## 10. Phase 7: Review UI 强化

### 目标

把 MVP 的核心产品价值做出来：让开发者高效审核 skill 是否真的带来增量价值。

### Review 页面必须展示

- Prompt。
- Input files。
- with-skill outputs。
- baseline outputs。
- Grader formal grades。
- Evidence。
- Previous iteration output。
- Previous feedback。
- 当前 feedback textarea。

### 文件预览优先级

1. text / markdown / json / csv。
2. image。
3. PDF。
4. XLSX。
5. DOCX。
6. unknown binary download/open。

### 工作项

- 实现 with-skill/baseline 并排视图。
- 实现 grading evidence 折叠展示。
- 实现 feedback 保存。
- 实现 previous iteration 对比。
- 实现基础文件预览。
- 实现 review completion 状态。

### 验收标准

- 用户能完整审查一次 iteration。
- 用户能给每个 run 写反馈。
- `feedback.json` 被保存为项目资产。
- 用户能比较当前轮和上一轮。
- benchmark 能辅助判断 skill 是否有增量价值。

## 11. Phase 8: Exporters

### 目标

把通用 Skill Project 导出为可分发或可注入的格式。

### V1 导出

- Claude-compatible skill directory。
- `.skill` zip package。
- prompt bundle 初版。

### 工作项

- 实现 Claude Skill exporter。
- 生成 `SKILL.md` frontmatter。
- 复制 resources。
- 排除 evals/runs/reviews/exports。
- 实现 `.skill` package。
- 实现 prompt bundle skeleton。

### 验收标准

- 通用 Skill Project 能导出成 Claude Skill。
- 导出的 `.skill` 不包含开发期资产。
- prompt bundle 可被 model adapter 注入。

## 12. 推荐的实际开发切入点

第一周不要写完整 UI。建议直接从下面三个最小目标开始：

1. `packages/schemas`
   - 定义 Skill Project、Eval Case、Run Artifact schema。

2. `packages/core`
   - 加载 sample project。
   - 生成 iteration/run 目录。

3. `packages/runtime`
   - 跑一个最小模型调用。
   - 允许模型写一个 output file。
   - 记录 transcript/metrics/timing。

一旦这三个跑通，就能尽快进入 with-skill/baseline 双跑。这个比先搭一个漂亮 desktop shell 更能降低项目风险。

## 13. V1 完成定义

V1 完成时，应该能够做到：

```text
开发者打开一个 Skill Project
  -> 创建或导入 eval cases
  -> 选择 executor/grader model
  -> 运行 with-skill + baseline
  -> 查看 outputs、grades、benchmark
  -> 写人工 feedback
  -> 手动修改 skill
  -> 再跑下一轮
  -> 导出 Claude-compatible .skill
```

V1 不要求模型自动修改 skill。这个能力进入 V2，并基于 V1 已经沉淀的 feedback、transcript、benchmark、outputs 实现。


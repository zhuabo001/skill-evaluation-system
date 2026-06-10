# Skill Creator 完整工作方式分析

## 概述

Skill-creator 是一个元技能——它帮助用户**创建、迭代优化和评估其他技能**。它是一个完整的开发工作流，包含测试、基准测试和打包。

---

## 核心工作流（"循环"）

1. **确定目标** —— 明确技能应该做什么、何时触发、输出格式
2. **编写草稿** —— 创建包含 YAML 前置元数据和 Markdown 指令的 `SKILL.md`
3. **运行测试用例** —— 使用子代理并行执行，分别进行 **带技能** 和 **不带技能**（基线）的运行
4. **评估** —— 通过 `grading.json` 进行定性人工审核 + 定量评分
5. **改进** —— 基于反馈重写技能，重复直到满意
6. **优化描述** —— 调整描述字段以提升触发精度
7. **打包** —— 将技能打包为可分发的 `.skill` 文件（zip 格式）

---

## SKILL.md 的结构

```
skill-name/
├── SKILL.md          # 必需：YAML 前置元数据 + 指令
├── scripts/          # 可选：可执行工具
├── references/       # 可选：按需加载到上下文中的文档
├── assets/           # 可选：模板、图标、字体
└── evals/            # 测试用例（打包时排除）
```

**渐进式披露**：
- 第 1 层：元数据名称 + 描述（始终在上下文中）
- 第 2 层：SKILL.md 正文（技能触发时加载）
- 第 3 层：捆绑资源（按需加载）

---

## 测试与评估基础设施

### 脚本（`scripts/`）

| 脚本 | 用途 |
|--------|---------|
| `run_eval.py` | 通过 `claude -p` 运行触发评估。并行启动多个查询以检查技能描述是否导致技能触发。以 `--include-partial-messages` 进行流式处理，实现早期检测。 |
| `run_loop.py` | 完整的评估 + 改进循环。将评估集拆分为 60/40 的训练/测试集，运行评估，调用 Claude 改进描述，重复最多 5 次迭代。选择测试分数最高的版本以避免过拟合。 |
| `improve_description.py` | 调用 `claude -p` 传入失败案例和历史的提示，以生成更好的技能描述。如果超过 1024 字符，会自动重试。 |
| `aggregate_benchmark.py` | 将单独的 `grading.json` 文件聚合到一个 `benchmark.json` 中，包含均值/标准差/最小值/最大值统计以及增量。 |
| `generate_report.py` | 从循环输出生成描述优化的 HTML 报告。 |
| `package_skill.py` | 验证并打包技能为 `.skill`（zip）文件，排除 `evals/`、`__pycache__`、`.DS_Store`。 |
| `quick_validate.py` | 验证 SKILL.md 前置元数据：名称格式（kebab-case）、描述长度（≤1024）、不允许使用尖括号、`allowed-tools`/`metadata`/`compatibility` 键。 |
| `utils.py` | 共享的 `parse_skill_md()` 解析 YAML 前置元数据。 |

### 代理（`agents/`）

- **`grader.md`** —— 根据执行记录单和输出文件评估断言。判断通过/失败并附证据。还会批判评估本身——标记那些即使错误输出也能通过的弱断言。
- **`comparator.md`** —— 在不被告知哪个输出来自哪个技能的情况下，对两个输出进行 A/B 盲评。按内容和结构维度打分（1-5 分），决定胜者。
- **`analyzer.md`** —— 两个作用：(1) 盲评获胜后的事后分析以提取可操作的见解；(2) 基准测试分析，识别表面模式（总是通过的断言、高波动性测试、时间/令牌权衡）。

### 查看器（`eval-viewer/`）

- **`generate_review.py`** —— 一个自包含的 HTTP 服务器（端口 3117），通过交互式 HTML 呈现测试运行结果。两种模式：
  - **实时服务器**：扫描工作区以查找包含 `outputs/` 目录的运行，生成包含内嵌文件数据的内联 HTML。在浏览器中打开。
  - **静态导出**（`--static`）：编写独立的 HTML 文件，适用于 Cowork/无头环境。
- **`viewer.html`** —— 带有两个标签页的前端模板：
  - **输出**：显示提示、输出文件（文本/图片/PDF/XLSX 渲染）、正式的评分结果、反馈文本框以及上一轮迭代的上下文
  - **基准测试**：显示通过率、时间和令牌统计，以及分析师观察结果

---

## 工作区结构

测试结果按迭代组织：

```
<skill-name>-workspace/
├── iteration-1/
│   ├── eval-0-descriptive-name/
│   │   ├── eval_metadata.json
│   │   ├── with_skill/
│   │   │   ├── outputs/          # 技能生成的文件
│   │   │   ├── grading.json      # 评分结果
│   │   │   └── timing.json       # 从子代理捕获的令牌/时长
│   │   └── without_skill/        # 基线运行
│   │       ├── outputs/
│   │       ├── grading.json
│   │       └── timing.json
│   ├── benchmark.json
│   ├── benchmark.md
│   └── feedback.json             # 用户从查看器提交的反馈
├── iteration-2/
│   └── ...
```

---

## 关键设计原则

1. **基于反馈的泛化** —— 不要对特定测试用例过拟合；进行概括
2. **在提示词中解释原因** —— 偏好解释 *为什么* 而不是死板的 "MUST"/"ALWAYS"
3. **保持 SKILL.md 精简** —— 少于 500 行，采用渐进式披露
4. **压入式描述** —— 描述应主动规定触发器，因为模型往往会欠触发
5. **底层模型不可知** —— 相同的结构适用于 Claude Code、Claude.ai 和 Cowork（各有特定适配）
6. **安全** —— 不允许恶意软件、利用漏洞或误导性技能

---

## 运行测试用例

### 带技能 vs 不带技能（基线）的两次运行

**每个测试用例都要跑两遍**，而且必须在同一轮（same turn）并行启动，不能先跑带技能的再回头跑基线。

#### 带技能运行（With-skill run）

启动一个子代理，**加载技能**，给它测试提示词，让它按技能指令完成任务。子代理会：

- 读取 SKILL.md 及其引用的脚本/参考文档
- 按照技能指示的方式工作
- 把产出文件保存到 `<workspace>/iteration-N/eval-X/with_skill/outputs/`

#### 基线运行（Baseline run）

基线是什么取决于场景：

| 场景 | 基线 |
|--------|----------|
| **新建技能** | 完全不加载技能。同样的提示词，不给技能路径，让裸模型自己完成任务。产出保存到 `without_skill/outputs/`。 |
| **改进已有技能** | 用旧版本技能。先 `cp -r` 做一个技能快照到 `workspace/skill-snapshot/`，然后让子代理用快照版本。产出保存到 `old_skill/outputs/`。 |

这样做意义在于**量化技能的增量价值**：技能到底有没有让模型做得更好？好在哪些方面？通过对比两边的通过率、耗时、token 消耗，得出净增量（delta）。

---

### 测试用例是谁创建的？

**是 Agent（即使用 skill-creator 技能的 Claude）在创建技能时一并创建的，但最终要用户确认。**

具体流程（SKILL.md 第 141-161 行）：

1. Agent 写完技能草稿后，**自己构思 2-3 个贴近真实用户场景的测试提示词**——是那种真实用户会说的话，不是抽象指令
2. Agent 把测试用例给用户看，征求确认："这几个测试用例行不行？要不要加？"
3. 用户确认或调整后，Agent 把它们保存到技能的 `evals/evals.json`
4. **断言（assertions）此时先不写**，等 Agent 启动运行、等结果的同时再起草断言

所以是 **Agent 草拟 + 用户审批** 的协作模式。Agent 有一定主动权，但最终决定权在用户。

---

### 测试用例的形式：输入、输出、判断依据

#### 输入：`evals/evals.json`

```json
{
  "skill_name": "example-skill",
  "evals": [
    {
      "id": 1,
      "prompt": "帮我把这个PDF里的表格提取出来，转成CSV格式",
      "expected_output": "一个包含表格数据的CSV文件，列名保持原样",
      "files": ["evals/files/sample_table.pdf"],
      "expectations": [
        "输出是有效的CSV格式",
        "CSV包含至少10行数据",
        "列名与PDF中的表头一致"
      ]
    }
  ]
}
```

**各字段含义：**

| 字段 | 说明 |
|------|------|
| `prompt` | 用户会说的话，模拟真实使用场景。不是抽象的任务描述，而是有细节、有上下文的具体请求。 |
| `expected_output` | 人类可读的预期结果描述。给评分者和用户看的，**本身不用于自动化判断**。 |
| `files` | 可选，测试输入文件（相对技能根目录的路径）。比如需要处理的 PDF、xlsx、图片。 |
| `expectations` | **可验证的断言列表**。这是量化评分的基础。Agent 在子代理运行期间起草，需要是客观可验证的。 |

#### 每个测试用例在运行时的元数据：`eval_metadata.json`

```json
{
  "eval_id": 0,
  "eval_name": "extract-table-to-csv",
  "prompt": "帮我把这个PDF里的表格提取出来...",
  "assertions": [
    "输出是有效的CSV格式",
    "CSV包含至少10行数据",
    "列名与PDF中的表头一致"
  ]
}
```

#### 子代理执行时的输出

子代理接到任务后，会产出实际文件，保存到 `outputs/` 目录下。同时生成：

- `outputs/metrics.json`：工具调用次数、创建的文件列表、错误数等
- `transcript.md`：完整的执行过程记录

#### 判断依据：评分器（Grader）的工作方式

评分由 `agents/grader.md` 定义的 Grader 子代理完成。它读三样东西：

1. **`eval_metadata.json` 里的断言列表**——这些是评分标准
2. **执行记录单（transcript.md）**——看子代理实际做了什么
3. **产出文件（outputs/ 目录）**——看最终产出是否正确

Grader 对每个断言逐一判断 **通过** 或 **失败**，必须附上具体证据：

```json
{
  "expectations": [
    {
      "text": "输出是有效的CSV格式",
      "passed": true,
      "evidence": "检查了 outputs/data.csv，pandas 可以成功解析，共 3 列 15 行"
    },
    {
      "text": "列名与PDF中的表头一致",
      "passed": false,
      "evidence": "PDF表头为 '姓名,年龄,部门'，CSV 列名为 'name,age,dept'——做了不必要的英文翻译"
    }
  ],
  "summary": {
    "passed": 2,
    "failed": 1,
    "total": 3,
    "pass_rate": 0.67
  }
}
```

**通过/失败的判断标准**（来自 grader.md）：

- **通过**：记录单或产出中能找到明确证据，且证据反映的是**真实的成果**，不是表面合规（比如文件名对了但内容是空的，不算过）
- **失败**：没找到证据，或证据矛盾，或无法验证，或只是表面合规
- **不确定时**：默认不通过（举证责任在断言方）

此外，Grader 还会**批判评估断言本身的质量**——如果一个断言即使产出错了也能通过，Grader 会标记出来，建议改进断言。

#### 判断依据的汇总：Benchmark

所有测试用例的所有运行评分完，用 `aggregate_benchmark.py` 汇总成 `benchmark.json`，包含：

- 每种配置（with_skill/without_skill）的通过率均值、标准差、最小值、最大值
- 时间和 token 消耗的均值 ± 标准差
- **增量（delta）**：带技能相对于基线的净提升/退步
- 分析笔记：哪些断言总是同时通过（没有区分力）、哪些测试波动大（可能是 flaky 的）

---

### 总结

| 维度 | 答案 |
|------|------|
| 谁创建测试用例 | Agent 草拟，用户确认 |
| 输入形式 | `evals/evals.json`，包含 prompt + 预期输出 + 可选输入文件 + 断言列表 |
| 运行方式 | 每个 case 跑两遍：带技能 vs 基线（无技能或旧版本），**同一轮并行启动** |
| 实际产出 | 子代理执行后保存到 `outputs/` 的文件 + `metrics.json` + `transcript.md` |
| 判断依据 | Grader 子代理读断言列表 + 记录单 + 产出文件，逐条判定 pass/fail 并附证据 |
| 量化指标 | 通过率、耗时、token 消耗，带技能与基线的增量对比 |

---

## 打分阶段

### 整体流程

```
子代理运行全部结束
        ↓
[1] 逐条评分（Agent 自动）
        ↓
[2] 汇总基准报告（脚本自动）
        ↓
[3] 分析师审视（Agent 自动）
        ↓
[4] 启动查看器（脚本自动）
        ↓
[5] 用户审核反馈（人工）
        ↓
[6] 读取反馈进入下一轮（Agent）
```

---

### [1] 逐条评分 —— Agent 自动完成

所有子代理跑完后，Agent 为每个运行的每个断言打分。两种方式：

- **启动 Grader 子代理**：把 `agents/grader.md` 发给它，让它读记录单 + 产出文件，逐条判断 pass/fail
- **Agent 自己内联评分**：Agent 不启动子代理，自己按 Grader 的标准来评

**关键原则**：能用脚本验证的断言就用脚本，不要肉眼判断。脚本更快、更可靠、还能跨迭代复用。

Grader 的工作内容（完全自动）：

| 工作 | 说明 |
|------|------|
| 读记录单 | 完整阅读 `transcript.md`，理解子代理实际做了什么 |
| 检查产出文件 | 读取 `outputs/` 下的每一个文件，**不只看记录单里声称的内容** |
| 逐条评价断言 | 对每个 expectation 给出 pass/fail + 具体证据引用 |
| 提取并验证隐含声明 | 除了预设断言，还从产出中抽取事实性声明（如"表单有12个字段"）并验证 |
| 读用户备注 | 如果有 `user_notes.md`，关注子代理自己标记的不确定项 |
| 批判断言质量 | 标记那些即使错误产出也能通过的弱断言，建议改进 |
| 汇总指标 | 收集执行指标（工具调用次数、错误数、输出大小）+ 耗时数据 |

输出为 `grading.json`，保存在每个运行目录下：

```json
{
  "expectations": [
    {
      "text": "输出是有效的CSV格式",
      "passed": true,
      "evidence": "检查了 outputs/data.csv，pandas 可以成功解析，共 3 列 15 行"
    },
    {
      "text": "列名与PDF中的表头一致",
      "passed": false,
      "evidence": "PDF表头为 '姓名,年龄,部门'，CSV 列名为 'name,age,dept'——做了不必要的英文翻译"
    }
  ],
  "summary": {
    "passed": 2,
    "failed": 1,
    "total": 3,
    "pass_rate": 0.67
  }
}
```

**这一步完全自动，不需要人参与。**

---

### [2] 汇总基准报告 —— 脚本自动完成

Agent 运行聚合脚本，一条命令：

```bash
python -m scripts.aggregate_benchmark <workspace>/iteration-N --skill-name <name>
```

脚本自动扫描所有 `grading.json`，产出两个文件：

- `benchmark.json`：结构化数据，包含每个配置的通过率均值 ± 标准差、耗时、token 消耗、以及 **delta（增量）**
- `benchmark.md`：人类可读的 Markdown 摘要表

**这一步完全自动，不需要人参与。**

---

### [3] 分析师审视 —— Agent 自动完成

Agent 读取 `benchmark.json`，按 `agents/analyzer.md` 第二部分（"Analyzing Benchmark Results"）的指引，自动识别：

- **不具区分力的断言**：带技能和没带技能都 100% 通过（这类断言测不出技能的价值）
- **可能损坏的断言**：两边都 100% 失败（可能任务本身就不可行）
- **高波动性测试**：同一断言不同运行间结果方差极大
- **技能拖后腿的情况**：没带技能反而通过、带了技能反而不通过
- **资源开销**：技能增加了多少耗时和 token 消耗，是否物有所值

输出为观察笔记列表，写入 `benchmark.json` 的 `notes` 字段。

**这一步完全自动，但它的产出会在后续展示给用户看。**

---

### [4] 启动查看器 —— 脚本自动完成

Agent 启动 HTTP 服务器（端口 3117），在浏览器中打开交互式审查页面：

```bash
nohup python eval-viewer/generate_review.py \
  <workspace>/iteration-N \
  --skill-name "my-skill" \
  --benchmark <workspace>/iteration-N/benchmark.json &
```

**这一步完全自动。**

---

### [5] 用户审核反馈 —— 人工完成 ⭐

**这是整个打分阶段唯一需要人参与的步骤。**

查看器页面有两个标签页：

**「Outputs」标签页**——用户逐个检查每个测试用例：

- 看到原始提示词（prompt）
- 看到**实际产出文件**（文本内联渲染、图片显示、PDF 预览、XLSX 内嵌）
- 看到 Grader 的**正式评分**（折叠展示，可展开看每条断言的 pass/fail + 证据）
- 看到**上一轮的产出**（迭代 2+ 时展示，折叠状态）
- 看到**上一轮的反馈**（迭代 2+ 时展示）
- 有一个**反馈文本框**，随输入自动保存
- 用前后按钮或方向键切换测试用例
- 全部审完后点击 **「Submit All Reviews」**

用户反馈示例：
```json
{
  "reviews": [
    {"run_id": "eval-0-with_skill", "feedback": "图表缺了坐标轴标签"},
    {"run_id": "eval-1-with_skill", "feedback": ""},
    {"run_id": "eval-2-with_skill", "feedback": "很完美，就这样"}
  ],
  "status": "complete"
}
```

- **空反馈 = 用户觉得没问题**
- **有反馈 = 这里需要改进**，Agent 下一轮要重点关注

**「Benchmark」标签页**——用户查看量化数据：

- 通过率对比（带技能 vs 基线）
- 耗时和 token 对比
- 每个测试用例的详细分解
- 分析师（步骤 [3]）发现的模式注释

**用户审核的是两个维度的东西：产出质量（定性） + 量化指标（定量）。**

---

### [6] 读取反馈 —— Agent 自动完成

用户说"看完了"之后，Agent 读取 `feedback.json`，关注**有具体投诉的测试用例**，以此为基础修改技能，进入下一轮迭代。

---

### 机器 vs 人的分工总结

| 步骤 | 执行者 | 自动化程度 |
|------|--------|-----------|
| 逐条评分（grading.json） | Agent / Grader 子代理 | 全自动 |
| 汇总基准（benchmark） | `aggregate_benchmark.py` 脚本 | 全自动 |
| 分析师审视 | Agent 按 analyzer.md 指引 | 全自动 |
| 启动查看器 | `generate_review.py` 脚本 | 全自动 |
| **用户审核 & 反馈** | **用户** | **纯人工** |
| 读取反馈 | Agent | 全自动 |

核心设计思路：**机器负责把所有东西算好、摆好、展示出来，人只需要做最终的质量判断。** 打分不是让机器代替人判断好坏，而是让机器提供结构化的证据和量化数据，帮助人更高效地做出判断。

---

## 改进skill

改进阶段是整个循环的**核心**。它回答两个问题：

- **改什么？** 改的就是 SKILL.md 的 Markdown 指令正文，也可能包括 `scripts/`、`references/` 等配套资源。
- **谁改？** **Agent 负责改**，但改进方向完全由用户的反馈驱动。

### 触发时机

用户在前一步的查看器中审完所有产出、写完反馈、点了「Submit All Reviews」之后，Agent 读取 `feedback.json`，从中提取有**具体投诉**的测试用例（空反馈 = 用户觉得没问题，不需要关注），然后开始改进。

### Agent 改进时的四大原则

#### 1. 从反馈中泛化，不要过拟合

这是最重要的原则。技能最终要被调用成千上万次、应对各种不同的提示词，而不是只在这两三个测试用例上表现好。所以：

- **不要**加针对特定测试用例的 "MUST" 规则、不要做overfit式的细碎修补
- **要**从用户反馈中提炼出更广泛的模式，比如换一种隐喻方式、推荐不同的工作模式

#### 2. 保持提示词精简，砍掉无效内容

Agent 不只读最终产出，还要**读子代理的执行记录单（transcript）**。如果发现技能的某些指令让模型浪费大量时间做无用功，就把那部分删掉。

#### 3. 解释 "为什么"，而非堆砌 "ALWAYS"/"NEVER"

不用死板的绝对命令。解释清楚为什么某件事重要，让模型**理解**背后的原因。如果发现自己写了满篇的 "ALWAYS" 或 "NEVER" 大写警告，说明写偏了——应该重构措辞，把道理讲明白。

#### 4. 发现重复劳动就打包为脚本

读所有测试用例的执行记录单，观察子代理们是否**不约而同地写了相似的辅助脚本**。比如 3 个测试里子代理都自己写了一个 `create_docx.py`，这说明技能该内置这个脚本。Agent 写一次，放到 `scripts/` 目录，在 SKILL.md 中告知使用它。这样未来每次调用都不用重复发明轮子。

### 改进后的迭代循环

```
Agent 读取 feedback.json
        ↓
Agent 按四大原则修改 SKILL.md（和/或 scripts/、references/）
        ↓
重新运行所有测试用例 → iteration-N+1/
        ↓
启动查看器，带上 --previous-workspace（用户能看到上一轮的对比）
        ↓
用户审核 → 提交反馈
        ↓
Agent 读取 feedback.json，再改
        ↓
...重复...
```

### 什么时候停止？

- 用户说"满意了"
- 所有反馈都是空的（用户觉得每个测试用例都好）
- 几轮迭代下来没有实质性进展

### 附带：可选的盲评系统

如果用户问 "新版本真的比旧版本好吗？"，有一个更严谨的盲评机制：

- **Comparator**（`agents/comparator.md`）：把两份产出发给一个独立子代理，不告诉它哪个是新版哪个是旧版，让它按内容和结构两个维度打分（1-5 分），选出胜者
- **Analyzer**（`agents/analyzer.md` 第一部分）：事后 "解密"，读取两边的技能内容和执行记录单，分析**为什么**赢的赢了、输的输在哪，给出具体的改进建议

这个盲评是可选的，大多数情况下人工审核循环就足够了。

### 总结

| 维度 | 答案 |
|------|------|
| 改进什么 | SKILL.md 的 Markdown 指令正文，以及 scripts/references/assets 等配套资源 |
| 谁执行改进 | **Agent 自动执行**（修改文件内容） |
| 改进的方向来源 | 用户的反馈（feedback.json 里有具体投诉的条目）+ Agent 分析执行记录单发现的模式 |
| 核心约束 | 泛化、不要过拟合、解释原因而非死板命令、发现重复劳动就打包脚本 |
| 循环结构 | 改进 → 重跑测试 → 查看器对比 → 用户反馈 → 再改进，直到满意 |
| 可选增强 | 盲评系统（Comparator + Analyzer），用于更严谨的版本对比 |

---

## 优化frontmatter描述

这个阶段**只优化 SKILL.md 前置元数据里的 `description` 字段**，不改技能正文。目标是**提升技能的触发准确率**——该触发的时候触发，不该触发的时候不触发。

### 为什么只优化描述？

技能在 Claude 的 `available_skills` 列表中只显示 **名称 + 描述**。Claude 在看到用户消息时，**仅凭这两个字段**决定要不要调用这个技能。描述不行，技能根本不会被触发，正文写得再好也没人看得到。

### 这个阶段和前面「打分阶段」的评测完全不同

| 对比维度 | 打分阶段（测试技能产出质量） | 优化描述阶段（测试触发准确性） |
|----------|--------------------------|------------------------------|
| 评测对象 | 技能正文指令 + 配套资源 | 仅 frontmatter 的 `description` 字段 |
| 评测方式 | 子代理执行任务，产出文件，Grader 评分 | `claude -p` 运行查询，检查是否触发了技能 |
| 核心指标 | **通过率**（assertion pass rate） | **触发准确率**（Precision / Recall / Accuracy） |
| 基线对比 | with_skill vs without_skill | 无基线，只看触发是否正确 |
| 迭代优化 | 人工反馈驱动 | `run_loop.py` 自动循环，Claude 自己改 description |
| 防过拟合 | 用户泛化反馈 | 60/40 训练/测试集分割，选测试集最优 |

---

### Step 1：Agent 生成 20 条触发评测查询

这些查询和前面测试技能产出的测试用例**完全不同**。前面的测试用例是完整任务（如"把 PDF 里的表格提取为 CSV"），这里的查询是**模拟用户说的第一句话**——Claude 看到这句话时就要决定是否调用技能。

Agent 生成两类查询：

| 类型 | 数量 | 含义 |
|------|------|------|
| **should-trigger** | 8-10 条 | 应该触发技能的查询。覆盖不同措辞、不同场景、边缘用例，包括用户不显式提技能名称但明显需要它的场景 |
| **should-not-trigger** | 8-10 条 | 不应该触发技能的查询。重点是**近误判**——和技能共享关键词或概念但实际上需要的是别的东西 |

例子对比：

| 质量 | 示例 |
|------|------|
| 差 | `"Format this data"`——太抽象，没有上下文 |
| 好 | `"ok so my boss just sent me this xlsx file (its in my downloads, called something like 'Q4 sales final FINAL v2.xlsx') and she wants me to add a column that shows the profit margin as a percentage. The revenue is in column C and costs are in column D i think"`——有文件名、有列名、有具体需求、有口语化表达 |

**should-trigger 查询**要覆盖：不同措辞（正式/随意）、用户不显式提技能名称的场景、不常见的用法、与其他技能竞争但应该胜出的场景。

**should-not-trigger 查询**要聚焦在**近误判**：共享关键词但实际场景不同、相邻领域的查询、措辞模糊的业务判断。不能是明显不相关的（如给 PDF 技能设 `"写个斐波那契函数"`），那样太容易，没有区分力。

---

### Step 2：用户审核评测集

Agent 用 `assets/eval_review.html` 模板生成一个审核页面，用户在里面可以：

- 编辑每条查询的文字
- 切换 should-trigger / should-not-trigger
- 增删条目
- 点击「Export Eval Set」导出 `eval_set.json`

这步很重要——评测查询的质量直接决定描述优化的质量。

---

### Step 3：运行自动优化循环

Agent 在后台跑 `run_loop.py`：

```bash
python -m scripts.run_loop \
  --eval-set <path-to-trigger-eval.json> \
  --skill-path <path-to-skill> \
  --model <当前会话用的模型> \
  --max-iterations 5 \
  --verbose
```

循环内部逻辑：

```
将 20 条查询按 60/40 拆分为训练集 (12条) 和测试集 (8条)，分层采样
        ↓
每轮迭代：
  1. 对当前 description，每条查询跑 3 次（claude -p），计算触发率
  2. 分别统计训练集和测试集的正确率
     - Precision / Recall / Accuracy
  3. 如果训练集全对 → 停止
  4. 否则，把失败案例和历史尝试发给 Claude，让它生成一个新的 description
  5. 用新 description 重复，最多 5 轮
        ↓
从所有迭代中选测试集分数最高的 description（不是训练集！防止过拟合）
        ↓
输出 JSON，包含 best_description
```

期间 Agent 会定期查看日志，告诉用户当前迭代到第几轮、分数怎么样。结束后自动在浏览器中打开 HTML 报告，展示每轮描述的得分变化。

---

### 底层机制：技能触发原理

Claude **只会对自身搞不定的任务**去查技能。简单的、一步到位的事（如 "读这个 PDF"），Claude 直接就用基础工具处理了，即使描述完美匹配也不会触发技能。**复杂、多步骤、专业领域的查询**才是技能触发的真正场景。

所以评测查询不能太简单（如 "读一下 file X"），必须是够复杂、够具体、让 Claude 觉得值得去查技能的那种。

---

### Step 4：应用最佳描述

Agent 把 `best_description` 写入 SKILL.md 的前置元数据，给用户看 before/after 对比和分数变化。

---

### 适用限制

需要 `claude -p` CLI 工具，仅在 Claude Code 中可用。Claude.ai 环境下跳过此阶段。

---

### 总结

| 维度 | 答案 |
|------|------|
| 目标 | 提升技能的**触发准确率**（该触发时触发，不该触发时不触发） |
| 改动范围 | **仅** SKILL.md 前置元数据的 `description` 字段 |
| 评测方式 | 20 条 should-trigger + should-not-trigger 查询，每条跑 3 次 |
| 核心指标 | Precision / Recall / Accuracy（触发分类正确率） |
| 优化方式 | `run_loop.py` 自动循环，Claude 分析失败案例生成新描述，60/40 训练测试分割防过拟合，最多 5 轮 |
| 人的参与 | 审核评测查询集（Step 2），确认最终的 before/after 描述（Step 4） |
| 适用限制 | 需要 `claude -p` CLI 工具，仅在 Claude Code 中可用 |

---

## 打包压缩

打包阶段是整个技能创建流程的收尾，主要做三件事。

### 1. 验证技能合法性

运行 `quick_validate.py`，在打包前做最后一轮校验：

| 检查项 | 规则 |
|--------|------|
| `SKILL.md` 是否存在 | 必须存在 |
| YAML 前置元数据格式 | 必须以 `---` 开头和闭合，内部为合法 YAML |
| `name` 字段 | 必须存在，kebab-case（小写字母+数字+连字符），不超过 64 字符，不能以连字符开头/结尾 |
| `description` 字段 | 必须存在，≤ 1024 字符，不能包含尖括号 `< >` |
| 允许的键 | 仅限 `name`、`description`、`license`、`allowed-tools`、`metadata`、`compatibility` |
| `compatibility`（可选） | 若存在，≤ 500 字符 |

不通过验证就不打包，Agent 需要修复问题后重试。

### 2. 打包为 .skill 文件

```bash
python -m scripts.package_skill <path/to/skill-folder>
```

`.skill` 文件本质上是一个 **zip 压缩包**（`zipfile.ZIP_DEFLATED`）。打包时会遍历技能目录，**选择性排除**以下内容：

| 排除项 | 排除原因 |
|--------|----------|
| `evals/` 目录（仅根级） | 测试用例和评分数据，属于开发期产物，用户不需要 |
| `__pycache__/` | Python 字节码缓存 |
| `node_modules/` | JS 依赖目录 |
| `*.pyc` | Python 编译缓存文件 |
| `.DS_Store` | macOS 系统垃圾文件 |

其余所有内容——SKILL.md、scripts/、references/、assets/——原样打包。嵌套子目录中的 `evals/` 不会被排除（只排除根级）。

打包时会在终端输出每个文件的添加/跳过情况。

### 3. 交付给用户

如果环境支持 `present_files` 工具，Agent 会直接呈现 `.skill` 文件给用户。否则，告诉用户文件路径，用户自行安装。

生成的文件位于技能目录同级或指定输出目录，命名格式为 `<skill-name>.skill`。

---

### 适用性

打包不需要 `claude -p` CLI 工具，只需要 Python 标准库（`zipfile`）+ 文件系统。所以 Claude Code 和 Claude.ai 环境都可使用。

---

### 总结

| 维度 | 答案 |
|------|------|
| 做什么 | 验证 → 打包 → 交付 |
| 产物 | 一个 `<skill-name>.skill` 文件（zip 格式） |
| 排除内容 | 根级 evals/、__pycache__/、node_modules/、*.pyc、.DS_Store |
| 包含内容 | SKILL.md + scripts/ + references/ + assets/ |
| 适用环境 | 只要有 Python 和文件系统就行，Claude Code 和 Claude.ai 均可 |

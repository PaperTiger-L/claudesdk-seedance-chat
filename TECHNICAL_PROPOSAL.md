# 技术方案：SeedanceChat — AI 视频脚本创作助手

## 1. 项目概述

利用 Claude Agent SDK 构建一个 Chat Webapp，核心能力通过 **Skill 系统** 接入 `seedance-storyboard-generator` 的专业视频脚本创作能力。用户通过自然语言对话，AI 按 Skill 方法论完成从故事分析到 Seedance 2.0 分镜脚本的全流程创作。

**定位**：面向 Seedance 2.0 平台用户的 AI 视频脚本创作助手，不是数据分析工具，而是创意内容生成工具。

---

## 2. 架构设计

```
用户浏览器
  │  WebSocket
  ▼
Express + WebSocket Server (port 3003)
  │
  ├─ /ws            → WebSocket 双向通信
  ├─ /api/health    → 健康检查
  ├─ /api/upload    → 文件上传（txt/md/小说文本）
  ├─ /api/files     → 获取已上传文件列表
  ├─ /api/output    → 获取已生成的作品列表
  └─ /output/*      → 静态文件服务（生成的脚本文件）
  │
  ▼
AgentSession (claude-agent-sdk)
  │  query() + MessageQueue
  │  settingSources: ["project"]  ← 自动加载 .claude/skills/
  │  allowedTools: [Skill, Read, Write, Glob, Grep]
  │
  ▼
.claude/skills/seedance-storyboard-generator/   ← 1 个 Skill（含 references/）
  ├── SKILL.md                    ← 核心工作流方法论
  └── references/
      ├── seedance-manual.md      ← Seedance 2.0 提示词模板与镜头语言
      ├── 优化分镜.md             ← 提示词优化指南
      ├── 好剧本.md               ← 优质剧本范例
      └── 故事转视频脚本-转换工具.md  ← 通用转换方法论
```

---

## 3. Skills 技术方案（核心）

### 3.1 Skill 类型分析

与 data-chat 的 19 个方法论型 Skill 不同，本项目只有 **1 个综合型 Skill**，但它的深度极大：

| 维度 | data-chat | seedance-chat |
|------|-----------|---------------|
| Skill 数量 | 19 个 | 1 个 |
| Skill 类型 | 方法论型（读文档→写代码→执行） | 方法论+模板型（读文档→理解方法论→生成创意内容） |
| 是否需要 Bash 执行 Python | 是（跑统计、画图） | **否**（纯文本/Markdown 输出） |
| 输出格式 | 图表 + 分析报告 | 剧本 + 素材清单 + 分镜脚本（均为 .md 文件） |
| 参考材料 | 代码模板 | 16+ 提示词模板、镜头语言库、范例剧本 |

### 3.2 Skill 工作原理

```
用户: "帮我把《水浒传》林冲风雪山神庙改编成5集短剧"
  │
  ▼
AI 收到消息，触发 seedance-storyboard-generator Skill
  │
  ▼
AI 自主执行 SKILL.md 定义的 5 步工作流：
  │
  ├─ Step 1: 分析输入
  │   → 确定输入类型（完整文本/大纲）
  │   → 提取角色、冲突、叙事弧线、情感节拍
  │
  ├─ Step 2: 确认制作参数（向用户提问）
  │   → 视觉风格？时长？画幅？基调？核心梗？
  │
  ├─ Step 3: 生成完整剧本
  │   → 读取 references/好剧本.md 了解质量标准
  │   → 按 △镜头格式 + 对白 + OS/VO + 闪回 + 字幕 生成剧本正文
  │   → 使用 Write 工具输出 [Title]_剧本.md
  │
  ├─ Step 4: 创建资产生成计划
  │   → 分类编号：C01-C99 角色 / S01-S99 场景 / P01-P99 道具
  │   → 为每个资产生成 Nana Banana Pro 提示词
  │   → 使用 Write 工具输出 [Title]_素材清单.md
  │
  └─ Step 5: 生成 Seedance 2.0 分镜脚本
      → 读取 references/seedance-manual.md 选择合适模板（16种）
      → 读取 references/优化分镜.md 优化提示词质量
      → 为每集生成时间轴格式提示词
      → 使用 Write 工具输出 [Title]_E[XX]_分镜.md
```

### 3.3 AI 工具使用模式

**与 data-chat 的关键区别：不需要 Bash 工具。**

```typescript
// data-chat 的工具集（需要执行 Python）
allowedTools: ["Skill", "Bash", "Read", "Write", "Edit", "Glob", "Grep"]

// seedance-chat 的工具集（纯文本创作）
allowedTools: ["Skill", "Read", "Write", "Glob", "Grep"]
```

AI 的工具使用流程：

| 工具 | 用途 | 示例 |
|------|------|------|
| **Skill** | 触发 seedance-storyboard-generator | 用户提到剧本/分镜/视频脚本时自动触发 |
| **Read** | 读取 references/ 下的模板和范例 | 读取 `references/seedance-manual.md` 选择模板 |
| **Write** | 输出生成的文件 | 写入 `[Title]_剧本.md`、`[Title]_素材清单.md`、`[Title]_E01_分镜.md` |
| **Glob** | 查找已有输出文件 | 检查 `output/` 下是否已有相关文件 |
| **Grep** | 搜索参考材料中的关键信息 | 在 references 中搜索特定模板或镜头术语 |

### 3.4 systemPrompt 设计

```
你是 SeedanceChat，一个专业的 AI 视频脚本创作助手，专为 Seedance 2.0 平台服务。

你拥有一个核心技能：seedance-storyboard-generator。

工作方式：
1. 理解用户的视频创作需求（故事、小说、概念、大纲等）
2. 触发 seedance-storyboard-generator 技能
3. 按 SKILL.md 的 5 步工作流执行：
   - 分析输入 → 确认参数 → 生成剧本 → 创建素材计划 → 生成分镜脚本
4. 使用 Read 工具读取 references/ 下的模板和范例
5. 使用 Write 工具将生成的文件保存到 output/ 目录
6. 用中文回复用户

重要规则：
- 剧本必须严格遵循 △ 镜头格式（每个镜头以 △ 开头）
- 对白标注：角色名（os）内心独白、角色名（vo）画外音、角色名（情绪）带情绪对白
- 特殊元素：【空镜】【闪回】【闪回结束】【字幕：xxx】
- 每集 15 秒，3-7 个镜头，必须包含情绪弧线
- 分镜脚本使用时间轴格式（0-3秒/3-6秒/...）
- 参考 references/seedance-manual.md 中的 16 种模板选择最合适的
- 参考 references/优化分镜.md 优化提示词质量

文件输出：
- 剧本：output/[标题]_剧本.md
- 素材清单：output/[标题]_素材清单.md
- 分镜脚本：output/[标题]_E[XX]_分镜.md（每集一个文件）

如果用户提供的信息不足以开始创作，主动询问以下关键参数：
1. 视觉风格（写实/动画/水墨/科幻/复古/电影感）
2. 时长（5集×15秒 / 10集×15秒 / 20集×15秒）
3. 画幅比例（16:9 / 9:16 / 2.35:1）
4. 基调（史诗/温馨/悬疑/欢快/忧伤）
5. 核心梗（一句话卖点）
```

---

## 4. 文件上传功能

### 4.1 与 data-chat 的差异

| 维度 | data-chat | seedance-chat |
|------|-----------|---------------|
| 上传类型 | CSV/Excel（数据分析） | TXT/MD/长文本（故事素材） |
| 文件用途 | Python 读取执行分析 | AI 读取内容作为创作素材 |
| 文件大小 | 可达 50MB | 通常较小（文本为主），上限 10MB |

### 4.2 后端上传接口

```typescript
const upload = multer({
  dest: path.join(process.cwd(), "uploads"),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowed = [".txt", ".md", ".doc", ".docx", ".pdf"];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});
```

### 4.3 AI 读取上传文件的方式

用户上传小说/故事文本后，AI 通过 Read 工具直接读取 `uploads/` 下的文件内容，无需 Python。

```
用户: [上传了 water_margin.txt] "帮我把这个改成5集短剧"
  │
  ▼
前端: 发送 chat 消息 + 文件路径
  │
  ▼
AI: Read uploads/water_margin.txt → 分析内容 → 开始创作工作流
```

---

## 5. 输出文件管理与展示

### 5.1 目录结构

```
seedance-chat/
├── output/                     # AI 生成的创作文件
│   ├── 林冲风雪山神庙_剧本.md
│   ├── 林冲风雪山神庙_素材清单.md
│   ├── 林冲风雪山神庙_E01_分镜.md
│   ├── 林冲风雪山神庙_E02_分镜.md
│   └── ...
├── uploads/                    # 用户上传的故事素材
└── ...
```

### 5.2 文件服务

```typescript
app.use("/output", express.static(path.join(process.cwd(), "output")));
```

### 5.3 前端展示策略

生成的 Markdown 文件在聊天界面通过 `react-markdown` 直接渲染，同时提供：
- **文件列表侧栏** — 展示已生成的所有文件，可点击预览
- **一键复制** — 分镜提示词可直接复制到 Seedance 2.0 平台使用
- **下载按钮** — 下载 .md 文件到本地

---

## 6. 后端架构

### 6.1 核心文件

复用 data-chat 的成熟架构，仅做以下调整：

| 文件 | 职责 | 变更 |
|------|------|------|
| `server/index.ts` | Express + WebSocket + 文件上传 | 修改端口(3003)、上传类型、systemPrompt |
| `server/agent-client.ts` | SDK 封装 | 修改 systemPrompt、allowedTools（去掉 Bash） |
| `server/message-queue.ts` | 异步消息队列 | 完全复用 |
| `server/logger.ts` | 日志 | 完全复用 |

### 6.2 AgentSession 关键配置

```typescript
const stream = query({
  prompt: this.queue as any,
  options: {
    cwd: path.resolve(process.cwd()),
    settingSources: ["project"],                    // 加载 .claude/skills/
    allowedTools: ["Skill", "Read", "Write", "Glob", "Grep"],  // 不需要 Bash/Edit
    systemPrompt: `...（见 3.4 节）...`,
    maxTurns: 30,                                   // 文本创作不需要 50 轮
    model: process.env.MODEL || "sonnet",
    permissionMode: "bypassPermissions",
  },
});
```

---

## 7. 前端架构

### 7.1 组件结构

```
src/
├── App.tsx                     # 主应用
├── components/
│   ├── ChatLayout.tsx          # 整体布局（左:文件列表 / 右:对话区）
│   ├── MessageList.tsx         # 消息列表
│   ├── MessageBubble.tsx       # 消息气泡（支持 Markdown 渲染）
│   ├── ToolCallCard.tsx        # 工具调用卡片（Read/Write/Glob 等）
│   ├── FileSidebar.tsx         # 左侧文件管理侧栏 [新增]
│   ├── FileCard.tsx            # 单个文件卡片（预览/下载/复制）
│   ├── InputBar.tsx            # 输入栏（含上传按钮）
│   └── WelcomeScreen.tsx       # 欢迎页（引导模板）
├── hooks/
│   ├── useWebSocket.ts         # WebSocket 管理（复用）
│   └── useFileUpload.ts        # 文件上传（复用，修改类型限制）
└── types.ts                    # 类型定义
```

### 7.2 欢迎页引导模板

为用户提供快捷创作入口：

```
┌─────────────────────────────────────────────┐
│          SeedanceChat — 视频脚本创作         │
│                                             │
│  选择一个创作模板开始：                       │
│                                             │
│  ┌─────────────┐  ┌─────────────┐          │
│  │ 小说改短剧   │  │ 故事大纲→剧本 │          │
│  │ 上传小说文本 │  │ 提供大纲概念  │          │
│  └─────────────┘  └─────────────┘          │
│  ┌─────────────┐  ┌─────────────┐          │
│  │ 单集分镜生成 │  │ 视频延长/编辑 │          │
│  │ 直接描述场景 │  │ 基于已有视频  │          │
│  └─────────────┘  └─────────────┘          │
│                                             │
│  或直接描述你想创作的视频内容...              │
└─────────────────────────────────────────────┘
```

### 7.3 消息类型扩展

```typescript
interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  toolCall?: {
    name: string;        // "Skill" | "Read" | "Write" | "Glob" | "Grep"
    input: unknown;
    status: "running" | "done";
  };
  files?: Array<{ name: string; path: string }>;  // 用户上传文件
}

interface GeneratedFile {
  name: string;          // 林冲风雪山神庙_E01_分镜.md
  path: string;          // output/林冲风雪山神庙_E01_分镜.md
  type: "script" | "asset" | "storyboard";  // 剧本/素材/分镜
  createdAt: number;
}
```

---

## 8. Skill 部署方案

### 8.1 目录部署

直接将 `seedance-storyboard-generator/` 复制到项目的 `.claude/skills/` 下：

```
seedance-chat/
├── .claude/
│   └── skills/
│       └── seedance-storyboard-generator/
│           ├── SKILL.md                    ← 核心工作流（5步）
│           └── references/
│               ├── seedance-manual.md      ← 16种模板 + 镜头语言 + 示例
│               ├── 优化分镜.md             ← 提示词优化公式
│               ├── 好剧本.md               ← 林冲范例剧本
│               └── 故事转视频脚本-转换工具.md  ← 通用转换方法论
```

### 8.2 Skill 触发机制

Skill 的 frontmatter `description` 字段已定义触发条件：

> 当用户要求：(1) 将文章/故事转换为视频脚本，(2) 生成Seedance 2.0分镜提示词，(3) 规划多集AI视频系列，(4) 为Nana Banana Pro等图像模型创建角色/场景/道具生成提示词时使用。

AI 通过 `settingSources: ["project"]` 自动发现并加载此 Skill，无需手动配置。

### 8.3 references/ 的读取策略

AI 在不同工作流阶段读取不同的 reference 文件：

| 工作流阶段 | 读取的 reference | 目的 |
|-----------|-----------------|------|
| Step 3 生成剧本 | `references/好剧本.md` | 参考优质剧本格式 |
| Step 4 创建素材 | — | 按 SKILL.md 中的资产生成计划格式 |
| Step 5 生成分镜 | `references/seedance-manual.md` | 选择合适的提示词模板（16种） |
| Step 5 优化提示词 | `references/优化分镜.md` | 按万能公式优化 |
| 全流程参考 | `references/故事转视频脚本-转换工具.md` | 通用转换方法论 |

---

## 9. 环境配置

### 9.1 .env

```env
# Claude API Key（必填）
ANTHROPIC_API_KEY=your-api-key

# API 基础地址（可选，用于第三方兼容接口）
ANTHROPIC_BASE_URL=

# 模型（推荐 sonnet，创意写作需要较强语言能力）
MODEL=sonnet

# 服务端口（避免与 data-chat:3002 冲突）
PORT=3003
```

### 9.2 依赖差异

| 依赖 | data-chat | seedance-chat | 说明 |
|------|-----------|---------------|------|
| Python 科学计算库 | 需要 | **不需要** | 无需执行代码 |
| multer | 需要（CSV） | 需要（TXT/MD） | 文件类型不同 |
| react-markdown | 需要 | 需要 | 都需要渲染 Markdown |
| @anthropic-ai/claude-agent-sdk | 需要 | 需要 | 核心引擎 |

---

## 10. 与 data-chat 的完整对比

| 维度 | data-chat | seedance-chat |
|------|-----------|---------------|
| **定位** | AI 数据分析助手 | AI 视频脚本创作助手 |
| **Skill 数量** | 19 个 | 1 个（含 4 个 reference 文件） |
| **Skill 类型** | 方法论型 → Python 执行 | 方法论+模板型 → 纯文本生成 |
| **AI 工作模式** | 读文档 → 编写执行 Python → 生成图表/报告 | 读文档 → 理解方法论/模板 → 生成创意内容 |
| **数据来源** | 用户上传 CSV/Excel | 用户上传 TXT/MD 或直接输入故事 |
| **输出格式** | PNG 图表 + 分析报告 | Markdown 剧本 + 素材清单 + 分镜脚本 |
| **allowedTools** | Skill, Bash, Read, Write, Edit, Glob, Grep | Skill, Read, Write, Glob, Grep |
| **需要 Python** | 是 | **否** |
| **maxTurns** | 50 | 30（文本创作轮次较少） |
| **前端特色** | 图片预览、拖拽上传 | 文件侧栏、一键复制提示词、创作模板引导 |
| **端口** | 3002 | 3003 |
| **上传限制** | 50MB CSV/Excel | 10MB TXT/MD |

---

## 11. 用户交互示例

### 示例 1：小说改短剧（完整流程）

```
用户: [上传 water_margin.txt]
      "帮我把林冲风雪山神庙改成5集×15秒的短剧"

AI:   我已经读取了你上传的文本。在开始创作前，需要确认几个参数：

      1. 视觉风格：建议使用「水墨+动画」风格，与古典武侠题材匹配。你觉得呢？
      2. 画幅比例：9:16 竖屏（适合短视频平台）还是 16:9 横屏？
      3. 基调：偏「复仇爽剧」还是「悲情史诗」？
      4. 核心梗：我初步定为"绝境反杀"，你觉得如何？

用户: "水墨动画风格，9:16竖屏，复仇爽剧，绝境反杀没错"

AI:   [触发 Skill，执行 5 步工作流]
      [Read: references/好剧本.md]
      [Read: references/seedance-manual.md]

      好的，我已完成创作！生成了以下文件：

      📄 林冲风雪山神庙_剧本.md — 完整5集剧本
      📄 林冲风雪山神庙_素材清单.md — 3个角色 + 3个场景 + 2个道具
      📄 林冲风雪山神庙_E01_分镜.md — 第1集分镜提示词
      📄 林冲风雪山神庙_E02_分镜.md — 第2集分镜提示词
      ...
      📄 林冲风雪山神庙_E05_分镜.md — 第5集分镜提示词

      你可以在左侧文件栏点击预览，也可以直接复制分镜提示词到 Seedance 2.0 使用。
```

### 示例 2：单集分镜生成（轻量使用）

```
用户: "帮我生成一个15秒的产品广告分镜，咖啡品牌，高端商务风格"

AI:   [触发 Skill，跳到 Step 5 生成分镜]
      [Read: references/seedance-manual.md → 选择模板二：产品展示类]
      [Read: references/优化分镜.md → 按万能公式优化]

      生成完成！📄 咖啡广告_E01_分镜.md

      这是基于 Seedance 2.0 产品展示类模板生成的分镜脚本，
      使用了推镜头+环绕镜头+微距特写组合...
```

### 示例 3：优化已有分镜

```
用户: "我有一个分镜提示词，帮我优化一下：[粘贴提示词]"

AI:   [Read: references/优化分镜.md]

      按照 Seedance 2.0 万能公式（主体+动作+场景+光影+镜头语言+风格+画质+约束）分析：

      ❌ 缺少：光影描述、画质保底、约束防崩
      ❌ 动作描述过于快速，容易导致画面崩坏

      优化后的提示词：
      ...
```

---

## 12. 实施步骤

```
Phase 1: 项目骨架（复用 data-chat）
  ├── 创建 seedance-chat/ 项目
  ├── 复制 server/ 核心文件（index.ts, agent-client.ts, message-queue.ts, logger.ts）
  ├── 复制 src/ 前端框架
  ├── 修改端口(3003)、allowedTools、systemPrompt
  └── 移除 Python 相关依赖和 Bash 工具

Phase 2: Skill 部署
  ├── 将 seedance-storyboard-generator/ 复制到 .claude/skills/
  ├── 验证 SKILL.md 和 references/ 4 个文件可被 AI 读取
  └── 基础测试：AI 能发现 Skill 并读取 references

Phase 3: 前端定制
  ├── 修改欢迎页（创作模板引导）
  ├── 添加文件侧栏组件（FileSidebar）
  ├── 修改文件上传类型限制（txt/md/doc）
  ├── 添加一键复制功能（分镜提示词）
  └── 优化 Markdown 渲染（剧本格式高亮）

Phase 4: 输出管理
  ├── output/ 目录的静态文件服务
  ├── /api/output 接口（列出已生成文件）
  ├── 文件预览和下载功能
  └── 文件类型识别（剧本/素材/分镜）

Phase 5: 端到端测试
  ├── 完整创作流程测试（小说→5集短剧）
  ├── 单集分镜生成测试
  ├── 文件上传 + AI 读取测试
  └── 提示词优化功能测试
```

---

## 13. 风险与注意事项

1. **单 Skill 深度大**：SKILL.md + 4 个 reference 文件内容非常丰富（共约 15000 字），AI 需要正确选择读取时机，避免一次性读取所有内容浪费 context
2. **创作轮次控制**：完整的 5 集短剧创作（剧本+素材+5个分镜）会产生大量输出，需要合理设置 maxTurns 和单次输出长度
3. **中文文件名**：输出文件可能包含中文文件名，需确保 Express 静态服务和文件系统正确处理 UTF-8
4. **创意内容一致性**：多集剧本需要保持角色、风格、色调一致性，systemPrompt 中需强调这一点
5. **Seedance 平台限制**：提示词不能包含敏感词、长度建议 < 300 字，AI 需要遵守这些平台约束
6. **不需要 Python**：与 data-chat 最大区别，部署更简单，不依赖任何 Python 环境

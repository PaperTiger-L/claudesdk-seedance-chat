# SeedanceChat — AI 视频脚本创作助手

通过自然语言对话生成专业 Seedance 2.0 视频脚本和分镜提示词的 Web 应用。基于 Claude Agent SDK 构建，内置完整的视频脚本创作技能，支持从故事分析到分镜脚本的全流程 AI 创作。

## 功能特性

- **自然语言创作** — 描述你想制作的视频内容，AI 自动生成剧本和分镜
- **全流程输出** — 一次性生成完整剧本、素材清单、Seedance 2.0 分镜提示词
- **16+ 提示词模板** — 涵盖叙事故事、产品展示、角色动作、风景旅拍、口播、音乐卡点等场景
- **文件上传** — 支持 TXT/MD 文本上传，AI 直接读取小说或故事素材
- **文件管理与预览** — 左侧文件栏管理生成的剧本/素材/分镜，支持预览和一键复制
- **创作模板引导** — 提供小说改短剧、故事大纲→剧本、单集分镜、提示词优化四个快捷入口

## 工作流程

AI 按 5 步专业工作流执行创作：

1. **分析输入** — 确定输入类型，提取角色、冲突、叙事弧线
2. **确认参数** — 视觉风格、时长、画幅、基调、核心梗
3. **生成剧本** — 标准 △ 镜头格式 + 对白 + OS/VO + 闪回 + 字幕
4. **创建素材计划** — 角色(C)/场景(S)/道具(P) 编号和图像生成提示词
5. **生成分镜脚本** — Seedance 2.0 时间轴格式提示词，可直接复制使用

## 技术栈

- **前端**: React 18 + TypeScript + Tailwind CSS 4 + Vite
- **后端**: Express + WebSocket + multer (文件上传)
- **AI 引擎**: Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`)
- **创作技能**: seedance-storyboard-generator (SKILL.md + 4 个参考文档)

## 环境要求

- Node.js >= 18
- Claude API Key（或兼容 Anthropic API 的第三方服务）

## 快速开始

### 1. 安装依赖

```bash
cd seedance-chat
npm install
```

### 2. 配置环境变量

编辑 `.env` 文件：

```env
# Claude API Key（必填）
ANTHROPIC_API_KEY=your-api-key

# API 基础地址（可选，用于第三方兼容接口）
ANTHROPIC_BASE_URL=https://ark.cn-beijing.volces.com/api/compatible

# 模型选择
MODEL=deepseek-v4-pro-260425

# 服务端口
PORT=3003
```

### 3. 启动开发服务器

```bash
npm run dev
```

启动后访问控制台显示的地址（通常为 http://localhost:5173），同时运行：
- **前端开发服务器**（Vite，热更新）
- **后端 API + WebSocket 服务器**（端口 3003）

### 4. 生产构建

```bash
npm run build
npm start
```

## Docker 部署

如果本地没有 Docker、但服务器有 Docker，推荐直接在服务器上部署。

### 1. 准备环境变量

在服务器项目根目录创建 `.env`：

```env
ANTHROPIC_API_KEY=your-api-key
ANTHROPIC_BASE_URL=https://ark.cn-beijing.volces.com/api/compatible
MODEL=deepseek-v4-pro-260425
PORT=3003
```

### 2. 构建并启动

```bash
docker compose build
docker compose up -d
```

### 3. 查看运行状态

```bash
docker compose ps
docker compose logs -f
```

### 4. 访问服务

浏览器访问：

```text
http://你的服务器IP:3003
```

健康检查：

```text
http://你的服务器IP:3003/api/health
```

### 5. 持久化目录

Docker Compose 已挂载以下目录为卷：
- `/app/output` — AI 生成文件
- `/app/uploads` — 上传素材
- `/app/logs` — 服务日志

重启容器后这些内容会保留。

## 使用方式

### 快捷模板

页面提供 4 个创作模板入口：

| 模板 | 说明 |
|------|------|
| 小说改短剧 | 上传小说文本，改编成 5-20 集 × 15 秒短剧 |
| 故事大纲→剧本 | 提供故事概念，生成完整剧本和分镜 |
| 单集分镜生成 | 描述一个场景，直接生成 Seedance 提示词 |
| 优化已有提示词 | 粘贴提示词，按万能公式优化质量 |

### 对话示例

```
你: 帮我写一个15秒的Seedance分镜，古代侠客在枫叶林练剑，水墨动画风格，9:16竖屏

AI: [触发创作技能，读取模板和参考]
    [生成剧本 → 素材清单 → 分镜脚本]
    [文件保存到 output/ 目录]

你: 帮我再生成第2集，接续第1集结尾

AI: [读取上一集结尾帧，生成连贯的第2集]
```

### 文件上传

点击输入框旁的 📎 按钮或拖拽文件上传故事文本（支持 .txt / .md），AI 会自动读取并基于内容创作。

### 文件管理

左侧文件栏自动显示所有生成文件：
- 🎬 **剧本** — 完整分镜头剧本
- 🎨 **素材** — 角色/场景/道具生成提示词
- 🎞️ **分镜** — Seedance 2.0 格式提示词

点击文件可预览内容，点击「复制」可一键复制分镜提示词到 Seedance 平台使用。

## 项目结构

```
seedance-chat/
├── .claude/skills/
│   └── seedance-storyboard-generator/   # 创作技能
│       ├── SKILL.md                     # 5步工作流方法论
│       └── references/
│           ├── seedance-manual.md       # 16种提示词模板 + 镜头语言
│           ├── 优化分镜.md              # 提示词优化万能公式
│           ├── 好剧本.md                # 优质剧本范例
│           └── 故事转视频脚本-转换工具.md # 通用转换方法论
├── server/
│   ├── index.ts                         # Express + WebSocket + 文件服务
│   ├── agent-client.ts                  # Claude Agent SDK 封装
│   ├── message-queue.ts                 # 异步消息队列
│   └── logger.ts                        # 日志记录
├── src/
│   ├── App.tsx                          # 主应用（含文件侧栏、欢迎页、消息）
│   ├── hooks/
│   │   ├── useWebSocket.ts             # WebSocket 连接管理
│   │   └── useFileUpload.ts            # 文件上传
│   ├── types.ts                         # TypeScript 类型定义
│   └── index.css                        # 样式
├── output/                              # AI 生成的创作文件
├── uploads/                             # 用户上传的故事素材
├── logs/                                # 运行日志
├── .env                                 # 环境变量
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## API 接口

| 端点 | 方法 | 说明 |
|------|------|------|
| `/ws` | WebSocket | 双向通信，消息推送 |
| `/api/health` | GET | 健康检查 |
| `/api/upload` | POST | 上传文本文件（multipart/form-data，限 10MB） |
| `/api/files` | GET | 获取已上传文件列表 |
| `/api/output` | GET | 获取已生成的创作文件（含类型分类） |
| `/output/*` | GET | 静态文件服务（生成的剧本和分镜） |

## 注意事项

- 复杂创作（多集短剧）可能需要较长响应时间（60-120 秒），请耐心等待
- Seedance 提示词建议控制在 300 字以内，过长可能导致指令遵循不一致
- 分镜提示词中避免使用敏感词，Seedance 平台可能会拒绝生成
- 剧本必须严格遵循 △ 镜头格式，每个镜头以 `△ ` 开头
- 动作描述建议使用"缓缓""轻拂"等慢速词汇，避免画面崩坏



## 感谢和参考
https://linux.do/  感谢佬友，

https://github.com/liangdabiao/claudesdk-skill  AI生成claude-agent-sdk 项目

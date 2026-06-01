import { query } from "@anthropic-ai/claude-agent-sdk";
import path from "path";
import dotenv from "dotenv";
import { MessageQueue } from "./message-queue.js";
import { fileLog } from "./logger.js";

dotenv.config({ override: true });

export interface SDKMessage {
  type: string;
  subtype?: string;
  session_id?: string;
  message?: {
    role: string;
    content: any;
  };
  result?: string;
  total_cost_usd?: number;
  duration_ms?: number;
}

export class AgentSession {
  private queue: MessageQueue;
  private outputIterator: AsyncIterator<SDKMessage> | null = null;
  public sdkSessionId: string | null = null;
  private started = false;

  constructor() {
    this.queue = new MessageQueue();
  }

  private ensureStarted() {
    if (this.started) return;
    this.started = true;

    fileLog("Agent", "Starting SDK | MODEL:", process.env.MODEL || "sonnet", "| BASE_URL:", process.env.ANTHROPIC_BASE_URL || "(default)");

    try {
      const stream = query({
        prompt: this.queue as any,
        options: {
          cwd: path.resolve(process.cwd()),
          settingSources: ["project"],
          allowedTools: ["Skill", "Read", "Write", "Glob", "Grep"],
          systemPrompt: `你是 SeedanceChat，一个专业的 AI 视频脚本创作助手，专为 Seedance 2.0 平台服务。

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

用户上传的文件在 uploads/ 目录下，生成的文件保存到 output/ 目录。`,
          maxTurns: 30,
          model: process.env.MODEL || "sonnet",
          permissionMode: "bypassPermissions",
          stderr: (data: string) => {
            fileLog("SDK.stderr", data.replace(/\n$/, ""));
          },
          env: {
            ...process.env,
            ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
            ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL,
          },
        },
      });

      this.outputIterator = stream[Symbol.asyncIterator]();
    } catch (e) {
      fileLog("Agent", "FAILED to start:", e);
      this.started = false;
    }
  }

  sendMessage(content: string) {
    fileLog("UserMsg", content);
    this.ensureStarted();
    this.queue.push(content);
  }

  async *getOutputStream(): AsyncGenerator<SDKMessage> {
    while (!this.outputIterator) {
      await new Promise((r) => setTimeout(r, 50));
    }

    while (true) {
      try {
        const { value, done } = await this.outputIterator.next();
        if (done) break;
        if (value?.type === "system" && value?.subtype === "init") {
          this.sdkSessionId = value.session_id ?? null;
          fileLog("Agent", "Session init:", this.sdkSessionId);
        } else {
          this.logSDKMessage(value);
        }
        yield value;
      } catch (e) {
        fileLog("Agent", "Stream error:", e);
        break;
      }
    }
  }

  private logSDKMessage(msg: SDKMessage) {
    if (msg.type === "assistant" && msg.message) {
      for (const block of msg.message.content) {
        if (block.type === "text" && block.text) {
          fileLog("AI", block.text.substring(0, 200));
        }
        if (block.type === "tool_use") {
          fileLog("ToolCall", block.name, JSON.stringify(block.input));
        }
      }
    }
    if (msg.type === "result") {
      fileLog("Result", msg.subtype || "", "cost:", msg.total_cost_usd, "duration:", msg.duration_ms + "ms");
    }
  }

  close() {
    this.queue.close();
  }
}

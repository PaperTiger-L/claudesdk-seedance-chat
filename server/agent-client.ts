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

export type ChatMode = "drama" | "ad";

function buildSystemPrompt(mode: ChatMode): string {
  if (mode === "ad") {
    return `你是 SeedanceChat 广告模式助手，负责生成带货视频、品牌TVC、产品展示和广告提示词。

目标：优先直接在聊天中产出可用脚本，少追问，中文回复。

规则：
- 不要把广告需求改成短剧
- 带货视频默认用 3-4 镜头：钩子、卖点演示、场景代入、促单
- TVC 默认用 5 镜头 × 3 秒
- 如无 Slogan，不要捏造
- 不要调用 AskUserQuestion
- 信息已足够时直接输出；只有缺少关键信息才追问，且一次最多问 2 个最关键问题
- 用户未指定时自行采用合理默认值：9:16，15 秒，贴合产品调性
- 不要默认写入 output 文件，结果直接在聊天中给出

输出优先级：
1. 直接给广告脚本或分镜
2. 如需要，再补充简短提示词

关键信息优先顺序：产品/品类、卖点、目标人群、平台/画幅、品牌调性。`;
  }

  return `你是 SeedanceChat 短剧模式助手，负责故事改编、短剧剧本和 Seedance 分镜生成。

目标：优先直接在聊天中产出可用内容，少追问，中文回复。

规则：
- 输出遵循短剧/分镜格式
- 不要调用 AskUserQuestion
- 信息已足够时直接输出；只有缺少关键信息才追问，且一次最多问 2 个最关键问题
- 用户未指定时自行采用合理默认值：15 秒、9:16、电影感或与题材匹配的风格
- 不要默认写入 output 文件，结果直接在聊天中给出

仅在以下信息明显缺失且会显著影响结果时再追问：风格、时长/集数、画幅、基调、核心梗。`;
}

export class AgentSession {
  private queue: MessageQueue;
  private outputIterator: AsyncIterator<SDKMessage> | null = null;
  public sdkSessionId: string | null = null;
  private started = false;
  private readonly mode: ChatMode;

  constructor(mode: ChatMode = "drama") {
    this.queue = new MessageQueue();
    this.mode = mode;
  }

  private ensureStarted() {
    if (this.started) return;
    this.started = true;

    fileLog("Agent", "Starting SDK | MODE:", this.mode, "| MODEL:", process.env.MODEL || "sonnet", "| BASE_URL:", process.env.ANTHROPIC_BASE_URL || "(default)");

    try {
      const stream = query({
        prompt: this.queue as any,
        options: {
          cwd: path.resolve(process.cwd()),
          settingSources: ["project"],
          allowedTools: ["Skill", "Read", "Write", "Glob", "Grep"],
          systemPrompt: buildSystemPrompt(this.mode),
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

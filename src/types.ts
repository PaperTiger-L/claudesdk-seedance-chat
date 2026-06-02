export type ChatMode = "drama" | "ad";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  toolCall?: {
    name: string;
    input: unknown;
    status: "running" | "done";
  };
  files?: Array<{ name: string; path: string }>;
}

export interface ConversationRecord {
  id: string;
  title: string;
  preview: string;
  mode: ChatMode;
  updatedAt: number;
  messageCount: number;
}

export interface WSMessage {
  type: "subscribed" | "user_message" | "assistant_message" | "tool_use" | "result" | "error";
  chatId?: string;
  content?: string;
  toolName?: string;
  toolInput?: unknown;
  success?: boolean;
  cost?: number;
  duration?: number;
  error?: string;
}

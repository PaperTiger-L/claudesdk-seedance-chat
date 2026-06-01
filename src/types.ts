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

export interface GeneratedFile {
  name: string;
  path: string;
  size: number;
  type: "script" | "asset" | "storyboard";
  modified: string;
}

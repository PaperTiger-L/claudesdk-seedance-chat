import { useState, useEffect, useRef, useCallback } from "react";
import type { ChatMessage, ChatMode, ConversationRecord, WSMessage } from "../types";

interface ConversationState {
  id: string;
  mode: ChatMode;
  messages: ChatMessage[];
  updatedAt: number;
}

function makeId(): string {
  if (typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function makeConversation(mode: ChatMode = "drama"): ConversationState {
  return {
    id: makeId(),
    mode,
    messages: [],
    updatedAt: Date.now(),
  };
}

function summarizeConversation(conversation: ConversationState): ConversationRecord {
  const firstUserMessage = conversation.messages.find((message) => message.role === "user");
  const lastMessage = [...conversation.messages].reverse().find((message) => message.role !== "system" || message.content);
  const titleSource = firstUserMessage?.content || lastMessage?.content || (conversation.mode === "ad" ? "广告模式新对话" : "短剧模式新对话");
  const previewSource = lastMessage?.content || "暂无内容";

  return {
    id: conversation.id,
    title: titleSource.replace(/\s+/g, " ").trim().slice(0, 24) || "新对话",
    preview: previewSource.replace(/\s+/g, " ").trim().slice(0, 60) || "暂无内容",
    mode: conversation.mode,
    updatedAt: conversation.updatedAt,
    messageCount: conversation.messages.length,
  };
}

const WS_URL = `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws`;

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout>>();
  const mountedRef = useRef(false);
  const activeConversationIdRef = useRef<string>("");
  const [conversations, setConversations] = useState<ConversationState[]>(() => {
    const initial = makeConversation("drama");
    activeConversationIdRef.current = initial.id;
    return [initial];
  });
  const [activeConversationId, setActiveConversationId] = useState(() => activeConversationIdRef.current);
  const [isConnected, setIsConnected] = useState(false);
  const [isThinking, setIsThinking] = useState(false);

  const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId) || conversations[0];
  const messages = activeConversation?.messages || [];
  const conversationRecords = [...conversations]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map(summarizeConversation);

  const subscribe = useCallback((chatId?: string, mode?: ChatMode) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const conversation = chatId
      ? conversations.find((item) => item.id === chatId)
      : conversations.find((item) => item.id === activeConversationIdRef.current);
    ws.send(JSON.stringify({
      type: "subscribe",
      chatId: chatId || activeConversationIdRef.current,
      mode: mode || conversation?.mode || "drama",
    }));
  }, [conversations]);

  const connect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      if (!mountedRef.current) {
        ws.close();
        return;
      }
      setIsConnected(true);
      subscribe();
    };

    ws.onclose = () => {
      setIsConnected(false);
      if (!mountedRef.current) return;
      reconnectRef.current = setTimeout(connect, 3000);
    };

    ws.onmessage = (event) => {
      const data: WSMessage = JSON.parse(event.data);
      const targetConversationId = data.chatId || activeConversationIdRef.current;

      switch (data.type) {
        case "user_message":
          break;
        case "assistant_message":
          setIsThinking(false);
          setConversations((prev) => prev.map((conversation) => (
            conversation.id === targetConversationId
              ? {
                  ...conversation,
                  messages: [
                    ...conversation.messages,
                    {
                      id: makeId(),
                      role: "assistant",
                      content: data.content || "",
                      timestamp: Date.now(),
                    },
                  ],
                  updatedAt: Date.now(),
                }
              : conversation
          )));
          break;
        case "tool_use":
          setConversations((prev) => prev.map((conversation) => (
            conversation.id === targetConversationId
              ? {
                  ...conversation,
                  messages: [
                    ...conversation.messages,
                    {
                      id: makeId(),
                      role: "system",
                      content: "",
                      toolCall: {
                        name: data.toolName || "unknown",
                        input: data.toolInput,
                        status: "running",
                      },
                      timestamp: Date.now(),
                    },
                  ],
                  updatedAt: Date.now(),
                }
              : conversation
          )));
          break;
        case "result":
          setIsThinking(false);
          setConversations((prev) => prev.map((conversation) => {
            if (conversation.id !== targetConversationId) return conversation;
            const idx = [...conversation.messages].reverse().findIndex((message) => message.toolCall);
            if (idx === -1) return conversation;
            const actualIdx = conversation.messages.length - 1 - idx;
            const updatedMessages = [...conversation.messages];
            updatedMessages[actualIdx] = {
              ...updatedMessages[actualIdx],
              toolCall: updatedMessages[actualIdx].toolCall
                ? { ...updatedMessages[actualIdx].toolCall!, status: "done" }
                : undefined,
            };
            return {
              ...conversation,
              messages: updatedMessages,
              updatedAt: Date.now(),
            };
          }));
          break;
        case "error":
          setIsThinking(false);
          setConversations((prev) => prev.map((conversation) => (
            conversation.id === targetConversationId
              ? {
                  ...conversation,
                  messages: [
                    ...conversation.messages,
                    {
                      id: makeId(),
                      role: "system",
                      content: `错误: ${data.error || "未知错误"}`,
                      timestamp: Date.now(),
                    },
                  ],
                  updatedAt: Date.now(),
                }
              : conversation
          )));
          break;
      }
    };

    wsRef.current = ws;
  }, [subscribe]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      clearTimeout(reconnectRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  const createConversation = useCallback((mode: ChatMode) => {
    const conversation = makeConversation(mode);
    activeConversationIdRef.current = conversation.id;
    setConversations((prev) => [conversation, ...prev]);
    setActiveConversationId(conversation.id);
    setIsThinking(false);
    subscribe(conversation.id, mode);
    return conversation.id;
  }, [subscribe]);

  const selectConversation = useCallback((conversationId: string) => {
    const conversation = conversations.find((item) => item.id === conversationId);
    if (!conversation) return;
    activeConversationIdRef.current = conversationId;
    setActiveConversationId(conversationId);
    setIsThinking(false);
    subscribe(conversationId, conversation.mode);
  }, [conversations, subscribe]);

  const sendMessage = useCallback((content: string, mode: ChatMode, files?: Array<{ name: string; path: string }>) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;

    const active = conversations.find((conversation) => conversation.id === activeConversationIdRef.current);
    if (!active || active.mode !== mode) {
      const conversationId = createConversation(mode);
      activeConversationIdRef.current = conversationId;
    }

    const fileNote = files?.length
      ? `\n\n已上传文件: ${files.map((file) => `${file.name} (${file.path})`).join(", ")}`
      : "";

    const targetConversationId = activeConversationIdRef.current;

    setConversations((prev) => prev.map((conversation) => (
      conversation.id === targetConversationId
        ? {
            ...conversation,
            mode,
            messages: [
              ...conversation.messages,
              {
                id: makeId(),
                role: "user",
                content: content + (files?.length ? `\n📎 ${files.map((file) => file.name).join(", ")}` : ""),
                timestamp: Date.now(),
                files,
              },
            ],
            updatedAt: Date.now(),
          }
        : conversation
    )));

    setIsThinking(true);
    ws.send(JSON.stringify({ type: "chat", chatId: targetConversationId, mode, content: content + fileNote }));
    return true;
  }, [conversations, createConversation]);

  const clearConversation = useCallback(() => {
    setConversations((prev) => prev.map((conversation) => (
      conversation.id === activeConversationIdRef.current
        ? { ...conversation, messages: [], updatedAt: Date.now() }
        : conversation
    )));
    setIsThinking(false);
  }, []);

  const deleteConversations = useCallback((ids: string[]) => {
    if (!ids.length) return;
    setConversations((prev) => {
      const remaining = prev.filter((conversation) => !ids.includes(conversation.id));
      if (remaining.length === 0) {
        const next = makeConversation("drama");
        activeConversationIdRef.current = next.id;
        setActiveConversationId(next.id);
        return [next];
      }

      if (ids.includes(activeConversationIdRef.current)) {
        const nextActive = remaining[0];
        activeConversationIdRef.current = nextActive.id;
        setActiveConversationId(nextActive.id);
      }

      return remaining;
    });
    setIsThinking(false);
  }, []);

  const setConversationMode = useCallback((mode: ChatMode) => {
    setConversations((prev) => prev.map((conversation) => (
      conversation.id === activeConversationIdRef.current
        ? { ...conversation, mode }
        : conversation
    )));
  }, []);

  return {
    messages,
    isConnected,
    isThinking,
    activeConversationId,
    activeConversationMode: activeConversation?.mode || "drama",
    conversationRecords,
    sendMessage,
    clearConversation,
    createConversation,
    selectConversation,
    deleteConversations,
    setConversationMode,
  };
}

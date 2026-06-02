import { useState, useRef, useEffect, useCallback, type MouseEvent } from "react";
import { useWebSocket } from "./hooks/useWebSocket";
import { useFileUpload } from "./hooks/useFileUpload";
import ReactMarkdown from "react-markdown";
import type { ChatMessage, ChatMode, ConversationRecord } from "./types";

function getModeMeta(mode: ChatMode) {
  if (mode === "ad") {
    return {
      icon: "📣",
      title: "广告模式",
      subtitle: "AI 广告小视频创作助手",
      uploadTitle: "上传产品资料文本",
      placeholder: "描述你的产品、卖点、受众或广告需求...",
    };
  }
  return {
    icon: "🎬",
    title: "短剧模式",
    subtitle: "AI 视频脚本创作助手",
    uploadTitle: "上传故事文本",
    placeholder: "描述你想创作的视频内容...",
  };
}

function formatTime(value: number) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function ConversationSidebar({
  records,
  activeConversationId,
  collapsed,
  onToggleCollapse,
  onSelect,
  onDelete,
  onCreate,
}: {
  records: ConversationRecord[];
  activeConversationId: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onSelect: (conversationId: string) => void;
  onDelete: (ids: string[]) => void;
  onCreate: () => void;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [anchorId, setAnchorId] = useState<string | null>(null);

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => records.some((record) => record.id === id)));
  }, [records]);

  const handleRowClick = useCallback((event: MouseEvent<HTMLButtonElement>, record: ConversationRecord) => {
    const isMultiKey = event.ctrlKey || event.metaKey;
    const currentIndex = records.findIndex((item) => item.id === record.id);

    if (event.shiftKey && anchorId) {
      const anchorIndex = records.findIndex((item) => item.id === anchorId);
      if (anchorIndex !== -1) {
        const [start, end] = [anchorIndex, currentIndex].sort((a, b) => a - b);
        const range = records.slice(start, end + 1).map((item) => item.id);
        setSelectedIds((prev) => Array.from(new Set([...prev, ...range])));
        return;
      }
    }

    if (isMultiKey) {
      setSelectedIds((prev) => (
        prev.includes(record.id) ? prev.filter((id) => id !== record.id) : [...prev, record.id]
      ));
      setAnchorId(record.id);
      return;
    }

    setSelectedIds([record.id]);
    setAnchorId(record.id);
    onSelect(record.id);
  }, [anchorId, onSelect, records]);

  const handleDelete = useCallback((ids: string[]) => {
    if (!ids.length) return;
    const confirmed = window.confirm(ids.length > 1 ? `确定删除选中的 ${ids.length} 条对话记录吗？` : "确定删除这条对话记录吗？");
    if (!confirmed) return;
    onDelete(ids);
    setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
    setAnchorId(null);
  }, [onDelete]);

  const selectAll = () => setSelectedIds(records.map((record) => record.id));
  const invertSelection = () => setSelectedIds(records.filter((record) => !selectedIds.includes(record.id)).map((record) => record.id));
  const clearSelection = () => {
    setSelectedIds([]);
    setAnchorId(null);
  };

  if (collapsed) {
    return (
      <aside className="flex w-[74px] shrink-0 flex-col border-r border-slate-200/80 bg-white/85 px-3 py-4 backdrop-blur-md shadow-[10px_0_30px_rgba(15,23,42,0.05)]">
        <button onClick={onToggleCollapse} className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">☰</button>
        <button onClick={onCreate} className="mt-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-slate-300">＋</button>
        <div className="mt-4 flex flex-1 flex-col gap-2 overflow-y-auto">
          {records.map((record) => (
            <button
              key={record.id}
              onClick={() => onSelect(record.id)}
              className={`flex h-11 w-11 items-center justify-center rounded-2xl text-lg shadow-sm ${record.id === activeConversationId ? "bg-sky-100 text-sky-700" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
              title={record.title}
            >
              {record.mode === "ad" ? "📣" : "🎬"}
            </button>
          ))}
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex w-[360px] shrink-0 flex-col border-r border-slate-200/80 bg-white/85 backdrop-blur-md shadow-[10px_0_30px_rgba(15,23,42,0.05)]">
      <div className="border-b border-slate-200/80 px-4 py-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">对话记录</p>
            <p className="text-xs text-slate-500">仅保存当前浏览器中的会话历史</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onCreate} className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-medium text-white shadow-sm">新对话</button>
            <button onClick={onToggleCollapse} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600">收起</button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={selectAll} disabled={!records.length} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 disabled:opacity-40">全选</button>
          <button onClick={invertSelection} disabled={!records.length} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 disabled:opacity-40">反选</button>
          <button onClick={clearSelection} disabled={!selectedIds.length} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 disabled:opacity-40">清空选择</button>
          <button onClick={() => handleDelete(selectedIds)} disabled={!selectedIds.length} className="rounded-full bg-rose-500 px-3 py-1 text-xs font-medium text-white shadow-sm disabled:opacity-40">批量删除</button>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          已选 <span className="font-semibold text-slate-900">{selectedIds.length}</span> / {records.length || 0}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {records.length === 0 && (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
            <p className="text-sm font-medium text-slate-700">暂无对话记录</p>
            <p className="mt-2 text-xs text-slate-500">点击“新对话”开始新的创作。</p>
          </div>
        )}

        {records.map((record) => {
          const isSelected = selectedIds.includes(record.id);
          const isActive = record.id === activeConversationId;
          return (
            <div
              key={record.id}
              className={`rounded-3xl border p-3 transition-all ${isActive ? "border-sky-300 bg-sky-50 shadow-sm shadow-sky-100" : isSelected ? "border-slate-300 bg-slate-50" : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"}`}
            >
              <div className="flex items-start gap-3">
                <button
                  onClick={(event) => handleRowClick(event, record)}
                  className="mt-1 flex h-5 w-5 items-center justify-center rounded-md border border-slate-300 bg-white text-[10px] text-sky-600"
                >
                  {isSelected ? "✓" : ""}
                </button>
                <button onClick={() => onSelect(record.id)} className="min-w-0 flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{record.mode === "ad" ? "📣" : "🎬"}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">{record.mode === "ad" ? "广告" : "短剧"}</span>
                    {isActive && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-700">当前</span>}
                  </div>
                  <p className="mt-2 truncate text-sm font-medium text-slate-900">{record.title}</p>
                  <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-slate-500">{record.preview}</p>
                  <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-400">
                    <span>{formatTime(record.updatedAt)}</span>
                    <span>•</span>
                    <span>{record.messageCount} 条消息</span>
                  </div>
                </button>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">单击打开，Shift/Ctrl 多选</span>
                <button onClick={() => handleDelete([record.id])} className="rounded-full bg-rose-50 px-3 py-1 text-[11px] font-medium text-rose-600 hover:bg-rose-100">删除</button>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  if (msg.role === "user") {
    return (
      <div className="mb-4 flex justify-end">
        <div className="max-w-[80%] rounded-[24px] rounded-br-md bg-gradient-to-br from-sky-500 to-blue-600 px-4 py-3 text-sm text-white shadow-lg shadow-sky-200/70 whitespace-pre-wrap">
          {msg.content}
          {msg.files?.map((file) => (
            <div key={file.path} className="mt-2 text-xs text-sky-100">📎 {file.name}</div>
          ))}
        </div>
      </div>
    );
  }

  if (msg.role === "system" && msg.toolCall) {
    const { toolCall } = msg;
    return (
      <div className="mb-3 flex justify-start">
        <div className={`max-w-[85%] rounded-[24px] border px-4 py-3 text-sm shadow-sm ${toolCall.status === "running" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
          <div className="flex items-center gap-2 font-medium">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${toolCall.status === "running" ? "bg-amber-400 animate-pulse" : "bg-emerald-400"}`} />
            {toolCall.name}
          </div>
          {toolCall.status === "running" && toolCall.input !== undefined && toolCall.input !== null && (
            <pre className="mt-2 max-h-20 overflow-hidden whitespace-pre-wrap text-xs text-amber-700/80">
              {String(typeof toolCall.input === "string" ? toolCall.input : JSON.stringify(toolCall.input as Record<string, unknown>, null, 2) || "").slice(0, 200)}
            </pre>
          )}
        </div>
      </div>
    );
  }

  if (msg.role === "system") {
    return (
      <div className="mb-3 flex justify-center">
        <div className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700 shadow-sm">{msg.content}</div>
      </div>
    );
  }

  return (
    <div className="mb-4 flex justify-start">
      <div className="max-w-[85%] rounded-[24px] rounded-bl-md border border-slate-200 bg-white px-5 py-4 text-slate-800 shadow-sm prose prose-slate prose-sm max-w-none">
        <ReactMarkdown
          components={{
            table: ({ children }) => (
              <div className="my-2 overflow-x-auto rounded-2xl border border-slate-200">
                <table className="min-w-full text-sm">{children}</table>
              </div>
            ),
          }}
        >
          {msg.content}
        </ReactMarkdown>
      </div>
    </div>
  );
}

function WelcomeScreen({ mode, onSelect }: { mode: ChatMode; onSelect: (text: string) => void }) {
  const templates = mode === "ad"
    ? [
        { icon: "🛍️", title: "带货视频", desc: "围绕产品卖点生成高转化带货脚本", prompt: "帮我生成一个15秒的带货广告视频脚本，产品是：" },
        { icon: "📺", title: "品牌 TVC", desc: "生成 5 镜头 × 3 秒的品牌广告分镜", prompt: "帮我生成一个品牌TVC分镜脚本，产品是：" },
        { icon: "📦", title: "产品展示", desc: "突出材质、功能和使用场景", prompt: "帮我生成一个产品展示广告视频，重点卖点是：" },
        { icon: "🔧", title: "优化广告提示词", desc: "优化现有广告或带货提示词", prompt: "帮我优化以下广告视频提示词：\n\n" },
      ]
    : [
        { icon: "📖", title: "小说改短剧", desc: "上传小说文本，改编成多集视频短剧", prompt: "帮我把我上传的故事改编成5集×15秒的短视频剧" },
        { icon: "📝", title: "故事大纲→剧本", desc: "提供故事概念，生成完整剧本和分镜", prompt: "我有一个故事概念，帮我开发成完整的剧本和分镜脚本" },
        { icon: "🎞️", title: "单集分镜", desc: "描述一个场景，直接生成 Seedance 分镜提示词", prompt: "帮我生成一个15秒的Seedance分镜提示词，场景是：" },
        { icon: "🔧", title: "优化提示词", desc: "粘贴已有提示词并进行结构优化", prompt: "帮我优化以下Seedance分镜提示词：\n\n" },
      ];

  const meta = getModeMeta(mode);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-6 text-center text-slate-500">
      <div className="flex h-20 w-20 items-center justify-center rounded-[28px] bg-white text-4xl shadow-lg shadow-slate-200/70">{meta.icon}</div>
      <div>
        <p className="text-2xl font-semibold text-slate-900">SeedanceChat · {meta.title}</p>
        <p className="mt-2 text-sm text-slate-500">选择模板快速开始，或直接描述你的创意需求。</p>
      </div>
      <div className="grid max-w-3xl grid-cols-1 gap-4 md:grid-cols-2">
        {templates.map((template) => (
          <button
            key={template.title}
            onClick={() => onSelect(template.prompt)}
            className="rounded-[28px] border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-200/70"
          >
            <div className="text-2xl">{template.icon}</div>
            <p className="mt-4 text-base font-semibold text-slate-900">{template.title}</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">{template.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const {
    messages,
    sendMessage,
    clearConversation,
    createConversation,
    selectConversation,
    deleteConversations,
    setConversationMode,
    conversationRecords,
    activeConversationId,
    activeConversationMode,
    isConnected,
    isThinking,
  } = useWebSocket();
  const { uploading, uploadedFiles, upload, clearFiles } = useFileUpload();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modeMeta = getModeMeta(activeConversationMode);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback((text?: string) => {
    const content = text || input.trim();
    if (!content && !uploadedFiles.length) return;
    const sent = sendMessage(content, activeConversationMode, uploadedFiles.length ? uploadedFiles : undefined);
    if (!sent) return;
    setInput("");
    clearFiles();
  }, [activeConversationMode, clearFiles, input, sendMessage, uploadedFiles]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      await upload(file);
    }
  };

  const switchMode = (nextMode: ChatMode) => {
    setConversationMode(nextMode);
    setInput("");
    clearFiles();
  };

  const handleCreateConversation = () => {
    createConversation(activeConversationMode);
    setInput("");
    clearFiles();
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.12),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(99,102,241,0.10),_transparent_22%),linear-gradient(180deg,#f8fbff_0%,#f1f5f9_48%,#eef2ff_100%)] text-slate-900">
      <div className="flex h-screen overflow-hidden">
        <ConversationSidebar
          records={conversationRecords}
          activeConversationId={activeConversationId}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
          onSelect={selectConversation}
          onDelete={deleteConversations}
          onCreate={handleCreateConversation}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-white/70 bg-white/80 px-6 py-4 backdrop-blur-md shadow-sm shadow-slate-200/40">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-xl text-white shadow-lg shadow-slate-300/30">{modeMeta.icon}</div>
                  <div>
                    <h1 className="text-xl font-semibold tracking-tight text-slate-900">SeedanceChat</h1>
                    <p className="text-sm text-slate-500">{modeMeta.subtitle}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex rounded-2xl border border-slate-200 bg-slate-50 p-1 shadow-inner shadow-white/60">
                  <button onClick={() => switchMode("drama")} className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${activeConversationMode === "drama" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>短剧模式</button>
                  <button onClick={() => switchMode("ad")} className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${activeConversationMode === "ad" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>广告模式</button>
                </div>
                <button onClick={clearConversation} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm hover:border-slate-300 hover:text-slate-900">清空当前对话</button>
                <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm">
                  <span className={`h-2.5 w-2.5 rounded-full ${isConnected ? "bg-emerald-400" : "bg-rose-400"}`} />
                  {isConnected ? "已连接" : "断开"}
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto px-6 py-6">
            {messages.length === 0 ? (
              <WelcomeScreen mode={activeConversationMode} onSelect={(text) => setInput(text)} />
            ) : (
              <div className="mx-auto max-w-5xl">
                {messages.map((message) => (
                  <MessageBubble key={message.id} msg={message} />
                ))}
              </div>
            )}

            {isThinking && (
              <div className="mx-auto mt-2 flex max-w-5xl justify-start">
                <div className="flex items-center gap-2 rounded-full border border-sky-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm shadow-sky-100/70">
                  <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-sky-400" />
                  创作中...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </main>

          {uploadedFiles.length > 0 && (
            <div className="border-t border-slate-200 bg-white/80 px-6 py-3 backdrop-blur-md">
              <div className="flex flex-wrap items-center gap-2">
                {uploadedFiles.map((file) => (
                  <span key={file.path} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">📎 {file.name}</span>
                ))}
                <button onClick={clearFiles} className="rounded-full bg-rose-50 px-3 py-1 text-xs font-medium text-rose-600 hover:bg-rose-100">清除</button>
              </div>
            </div>
          )}

          <div className="border-t border-slate-200 bg-white/85 px-6 py-4 backdrop-blur-md">
            <div className="mx-auto flex max-w-5xl items-end gap-3 rounded-[28px] border border-slate-200 bg-white p-3 shadow-lg shadow-slate-200/60">
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".txt,.md,.doc,.docx"
                multiple
                onChange={(event) => handleFileSelect(event.target.files)}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-lg text-slate-600 transition hover:bg-slate-200 hover:text-slate-900 disabled:opacity-50"
                title={modeMeta.uploadTitle}
              >
                {uploading ? "⏳" : "📎"}
              </button>
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={modeMeta.placeholder}
                rows={1}
                className="min-h-[48px] flex-1 resize-none rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-sky-200"
              />
              <button
                onClick={() => handleSend()}
                disabled={(!input.trim() && !uploadedFiles.length) || !isConnected}
                className="flex h-12 min-w-[60px] items-center justify-center rounded-2xl bg-slate-900 px-4 text-white shadow-lg shadow-slate-300/50 transition hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
              >
                ➤
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

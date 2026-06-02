import { useState, useRef, useEffect, useCallback, type MouseEvent } from "react";
import { useWebSocket } from "./hooks/useWebSocket";
import { useFileUpload } from "./hooks/useFileUpload";
import ReactMarkdown from "react-markdown";
import type { ChatMessage, ChatMode, GeneratedFile } from "./types";

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

function getTypeMeta(type: GeneratedFile["type"]) {
  if (type === "script") return { icon: "🎬", label: "剧本" };
  if (type === "asset") return { icon: "🎨", label: "素材" };
  if (type === "storyboard") return { icon: "🎞️", label: "分镜" };
  if (type === "ad") return { icon: "📣", label: "广告" };
  return { icon: "📄", label: "文件" };
}

function formatModified(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function FileSidebar({
  files,
  onRefresh,
  onDelete,
}: {
  files: GeneratedFile[];
  onRefresh: () => void;
  onDelete: (files: GeneratedFile[]) => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState("");
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [anchorPath, setAnchorPath] = useState<string | null>(null);

  useEffect(() => {
    setSelectedPaths((prev) => prev.filter((path) => files.some((file) => file.path === path)));
    if (preview && !files.some((file) => file.path === preview)) {
      setPreview(null);
      setPreviewContent("");
    }
  }, [files, preview]);

  const openPreview = useCallback(async (path: string) => {
    try {
      const res = await fetch(`/${path}`);
      const text = await res.text();
      setPreviewContent(text);
      setPreview(path);
    } catch {
      setPreviewContent("无法加载文件内容");
      setPreview(path);
    }
  }, []);

  const copyContent = useCallback(() => {
    navigator.clipboard.writeText(previewContent);
  }, [previewContent]);

  const handleRowClick = useCallback((event: MouseEvent<HTMLButtonElement>, file: GeneratedFile) => {
    const isMultiKey = event.ctrlKey || event.metaKey;
    const currentIndex = files.findIndex((item) => item.path === file.path);

    if (event.shiftKey && anchorPath) {
      const anchorIndex = files.findIndex((item) => item.path === anchorPath);
      if (anchorIndex !== -1) {
        const [start, end] = [anchorIndex, currentIndex].sort((a, b) => a - b);
        const range = files.slice(start, end + 1).map((item) => item.path);
        setSelectedPaths((prev) => Array.from(new Set([...prev, ...range])));
        return;
      }
    }

    if (isMultiKey) {
      setSelectedPaths((prev) => (
        prev.includes(file.path) ? prev.filter((path) => path !== file.path) : [...prev, file.path]
      ));
      setAnchorPath(file.path);
      return;
    }

    setSelectedPaths([file.path]);
    setAnchorPath(file.path);
  }, [anchorPath, files]);

  const selectedFiles = files.filter((file) => selectedPaths.includes(file.path));
  const allSelected = files.length > 0 && selectedPaths.length === files.length;

  const selectAll = useCallback(() => {
    setSelectedPaths(files.map((file) => file.path));
    setAnchorPath(files[0]?.path ?? null);
  }, [files]);

  const invertSelection = useCallback(() => {
    setSelectedPaths(files.filter((file) => !selectedPaths.includes(file.path)).map((file) => file.path));
  }, [files, selectedPaths]);

  const clearSelection = useCallback(() => {
    setSelectedPaths([]);
    setAnchorPath(null);
  }, []);

  const handleDeleteSelected = useCallback(() => {
    if (!selectedFiles.length) return;
    onDelete(selectedFiles);
    setSelectedPaths([]);
    setAnchorPath(null);
  }, [onDelete, selectedFiles]);

  return (
    <aside className="w-[420px] border-r border-slate-200/80 bg-white/85 backdrop-blur-md flex flex-col shrink-0 shadow-[10px_0_30px_rgba(15,23,42,0.05)]">
      <div className="px-4 py-4 border-b border-slate-200/80 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">生成记录</p>
            <p className="text-xs text-slate-500">支持多选、预览与批量删除</p>
          </div>
          <button onClick={onRefresh} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:border-slate-300 hover:text-slate-900">
            刷新
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={selectAll} disabled={!files.length || allSelected} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 disabled:opacity-40">全选</button>
          <button onClick={invertSelection} disabled={!files.length} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 disabled:opacity-40">反选</button>
          <button onClick={clearSelection} disabled={!selectedPaths.length} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 disabled:opacity-40">清空选择</button>
          <button onClick={handleDeleteSelected} disabled={!selectedFiles.length} className="rounded-full bg-rose-500 px-3 py-1 text-xs font-medium text-white shadow-sm shadow-rose-200 disabled:opacity-40">批量删除</button>
        </div>
        <div className="rounded-2xl bg-slate-50 px-3 py-2 text-xs text-slate-600 border border-slate-200/80">
          已选 <span className="font-semibold text-slate-900">{selectedFiles.length}</span> / {files.length || 0}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {files.length === 0 && (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
            <p className="text-sm font-medium text-slate-700">暂无生成记录</p>
            <p className="mt-2 text-xs text-slate-500">开始创作后，脚本与提示词会展示在这里。</p>
          </div>
        )}

        {files.map((file) => {
          const meta = getTypeMeta(file.type);
          const isSelected = selectedPaths.includes(file.path);
          const isPreviewing = preview === file.path;
          return (
            <div
              key={file.path}
              className={`rounded-3xl border p-3 transition-all ${isSelected ? "border-sky-300 bg-sky-50 shadow-sm shadow-sky-100" : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"}`}
            >
              <div className="flex items-start gap-3">
                <button
                  onClick={(event) => handleRowClick(event, file)}
                  className="mt-1 flex h-5 w-5 items-center justify-center rounded-md border border-slate-300 bg-white text-[10px] text-sky-600"
                  aria-label={`选择 ${file.name}`}
                >
                  {isSelected ? "✓" : ""}
                </button>

                <button onDoubleClick={() => openPreview(file.path)} onClick={(event) => handleRowClick(event, file)} className="min-w-0 flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{meta.icon}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">{meta.label}</span>
                  </div>
                  <p className="mt-2 truncate text-sm font-medium text-slate-900">{file.name}</p>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
                    <span>{formatModified(file.modified)}</span>
                    <span>•</span>
                    <span>{formatSize(file.size)}</span>
                  </div>
                </button>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">单击选择，Shift/Ctrl 多选，双击预览</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => openPreview(file.path)} className={`rounded-full px-3 py-1 text-[11px] font-medium ${isPreviewing ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
                    预览
                  </button>
                  <button onClick={() => onDelete([file])} className="rounded-full bg-rose-50 px-3 py-1 text-[11px] font-medium text-rose-600 hover:bg-rose-100">
                    删除
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {preview && (
        <div className="border-t border-slate-200 bg-white px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-700">预览</p>
              <p className="max-w-[280px] truncate text-xs text-slate-500">{preview.split("/").pop()}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={copyContent} className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-200">复制</button>
              <button onClick={() => setPreview(null)} className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-200">关闭</button>
            </div>
          </div>
          <div className="mt-3 max-h-[240px] overflow-y-auto rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3">
            <pre className="whitespace-pre-wrap text-[11px] leading-5 text-slate-700">{previewContent}</pre>
          </div>
        </div>
      )}
    </aside>
  );
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[80%] rounded-[24px] rounded-br-md bg-gradient-to-br from-sky-500 to-blue-600 px-4 py-3 text-sm text-white shadow-lg shadow-sky-200/70 whitespace-pre-wrap">
          {msg.content}
          {msg.files?.map((file) => (
            <div key={file.path} className="mt-2 text-xs text-sky-100">
              📎 {file.name}
            </div>
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
        <div className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700 shadow-sm">
          {msg.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start mb-4">
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
    <div className="flex h-full flex-col items-center justify-center gap-6 text-center text-slate-500 px-6">
      <div className="flex h-20 w-20 items-center justify-center rounded-[28px] bg-white shadow-lg shadow-slate-200/70 text-4xl">
        {meta.icon}
      </div>
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
  const { messages, sendMessage, clearConversation, isConnected, isThinking } = useWebSocket();
  const { uploading, uploadedFiles, upload, clearFiles } = useFileUpload();
  const [mode, setMode] = useState<ChatMode>("drama");
  const [input, setInput] = useState("");
  const [outputFiles, setOutputFiles] = useState<GeneratedFile[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modeMeta = getModeMeta(mode);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const refreshOutputFiles = useCallback(async () => {
    try {
      const res = await fetch("/api/output");
      if (res.ok) {
        const data = await res.json();
        setOutputFiles(data);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    refreshOutputFiles();
  }, [messages, refreshOutputFiles]);

  const handleDeleteFiles = useCallback(async (files: GeneratedFile[]) => {
    if (!files.length) return;
    const isBatch = files.length > 1;
    const confirmed = window.confirm(isBatch ? `确定删除选中的 ${files.length} 条记录吗？` : `确定删除 ${files[0].name} 吗？`);
    if (!confirmed) return;

    try {
      await Promise.all(files.map(async (file) => {
        const res = await fetch(`/api/output/${encodeURIComponent(file.name)}`, { method: "DELETE" });
        if (!res.ok) throw new Error(file.name);
      }));
      const deleted = new Set(files.map((file) => file.path));
      setOutputFiles((prev) => prev.filter((file) => !deleted.has(file.path)));
    } catch {
      window.alert("删除失败，请稍后重试");
    }
  }, []);

  const handleSend = useCallback((text?: string) => {
    const content = text || input.trim();
    if (!content && !uploadedFiles.length) return;
    const sent = sendMessage(content, mode, uploadedFiles.length ? uploadedFiles : undefined);
    if (!sent) return;
    setInput("");
    clearFiles();
  }, [clearFiles, input, mode, sendMessage, uploadedFiles]);

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
    setMode(nextMode);
    setInput("");
    clearFiles();
    clearConversation();
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.12),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(99,102,241,0.10),_transparent_22%),linear-gradient(180deg,#f8fbff_0%,#f1f5f9_48%,#eef2ff_100%)] text-slate-900">
      <div className="flex h-screen overflow-hidden">
        <FileSidebar files={outputFiles} onRefresh={refreshOutputFiles} onDelete={handleDeleteFiles} />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-white/70 bg-white/80 px-6 py-4 backdrop-blur-md shadow-sm shadow-slate-200/40">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-xl text-white shadow-lg shadow-slate-300/30">
                    {modeMeta.icon}
                  </div>
                  <div>
                    <h1 className="text-xl font-semibold tracking-tight text-slate-900">SeedanceChat</h1>
                    <p className="text-sm text-slate-500">{modeMeta.subtitle}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex rounded-2xl border border-slate-200 bg-slate-50 p-1 shadow-inner shadow-white/60">
                  <button onClick={() => switchMode("drama")} className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${mode === "drama" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
                    短剧模式
                  </button>
                  <button onClick={() => switchMode("ad")} className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${mode === "ad" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
                    广告模式
                  </button>
                </div>
                <button onClick={clearConversation} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm hover:border-slate-300 hover:text-slate-900">
                  清空对话
                </button>
                <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm">
                  <span className={`h-2.5 w-2.5 rounded-full ${isConnected ? "bg-emerald-400" : "bg-rose-400"}`} />
                  {isConnected ? "已连接" : "断开"}
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto px-6 py-6">
            {messages.length === 0 ? (
              <WelcomeScreen mode={mode} onSelect={(text) => setInput(text)} />
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
                  <span key={file.path} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                    📎 {file.name}
                  </span>
                ))}
                <button onClick={clearFiles} className="rounded-full bg-rose-50 px-3 py-1 text-xs font-medium text-rose-600 hover:bg-rose-100">
                  清除
                </button>
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

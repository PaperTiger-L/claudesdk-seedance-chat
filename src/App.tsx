import { useState, useRef, useEffect, useCallback } from "react";
import { useWebSocket } from "./hooks/useWebSocket";
import { useFileUpload } from "./hooks/useFileUpload";
import ReactMarkdown from "react-markdown";
import type { ChatMessage, GeneratedFile } from "./types";

// --- File Sidebar ---
function FileSidebar({ files, onRefresh }: { files: GeneratedFile[]; onRefresh: () => void }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState("");

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

  const typeIcon = (type: string) => {
    if (type === "script") return "🎬";
    if (type === "asset") return "🎨";
    if (type === "storyboard") return "🎞️";
    return "📄";
  };

  const typeLabel = (type: string) => {
    if (type === "script") return "剧本";
    if (type === "asset") return "素材";
    if (type === "storyboard") return "分镜";
    return "文件";
  };

  return (
    <aside className="w-[512px] border-r border-gray-800 bg-gray-900 flex flex-col shrink-0">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
        <span className="text-sm font-medium text-gray-300">生成文件</span>
        <button onClick={onRefresh} className="text-xs text-gray-500 hover:text-gray-300">刷新</button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {files.length === 0 && (
          <p className="text-xs text-gray-600 text-center mt-4 px-2">尚无生成文件，开始创作后将自动出现在这里</p>
        )}
        {files.map((f) => (
          <button
            key={f.path}
            onClick={() => openPreview(f.path)}
            className={`w-full text-left px-3 py-2 border-b border-gray-800/50 hover:bg-gray-800/50 transition-colors ${preview === f.path ? "bg-gray-800" : ""}`}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm">{typeIcon(f.type)}</span>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-200 truncate">{f.name}</p>
                <p className="text-[10px] text-gray-500">{typeLabel(f.type)}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Preview panel */}
      {preview && (
        <div className="border-t border-gray-800 flex flex-col max-h-[50%]">
          <div className="flex items-center justify-between px-3 py-1 border-b border-gray-800/50">
            <span className="text-xs text-gray-400 truncate max-w-[400px]">{preview.split("/").pop()}</span>
            <div className="flex gap-1">
              <button onClick={copyContent} className="text-[10px] text-gray-500 hover:text-gray-300 px-1">复制</button>
              <button onClick={() => setPreview(null)} className="text-[10px] text-gray-500 hover:text-gray-300 px-1">关闭</button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-2">
            <pre className="text-[11px] text-gray-300 whitespace-pre-wrap">{previewContent}</pre>
          </div>
        </div>
      )}
    </aside>
  );
}

// --- Message Bubble ---
function MessageBubble({ msg }: { msg: ChatMessage }) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end mb-3">
        <div className="bg-blue-600 text-white rounded-2xl rounded-br-sm px-4 py-2 max-w-[80%] whitespace-pre-wrap">
          {msg.content}
          {msg.files?.map((f) => (
            <div key={f.path} className="text-xs text-blue-200 mt-1">
              📎 {f.name}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (msg.role === "system" && msg.toolCall) {
    const tc = msg.toolCall;
    return (
      <div className="flex justify-start mb-2">
        <div className={`rounded-xl px-3 py-2 max-w-[85%] text-sm ${tc.status === "running" ? "bg-yellow-900/40 border border-yellow-700" : "bg-gray-800 border border-gray-700"}`}>
          <div className="flex items-center gap-2">
            {tc.status === "running" ? (
              <span className="inline-block w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
            ) : (
              <span className="inline-block w-2 h-2 bg-green-400 rounded-full" />
            )}
            <span className="font-mono text-gray-300">{tc.name}</span>
          </div>
          {tc.status === "running" && tc.input !== undefined && tc.input !== null && (
            <pre className="text-xs text-gray-400 mt-1 max-h-20 overflow-hidden">
              {String(typeof tc.input === "string" ? tc.input : (JSON.stringify(tc.input as Record<string, unknown>, null, 2) || "")).slice(0, 200)}
            </pre>
          )}
        </div>
      </div>
    );
  }

  if (msg.role === "system") {
    return (
      <div className="flex justify-center mb-2">
        <div className="bg-red-900/30 text-red-300 rounded-lg px-4 py-2 text-sm">
          {msg.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start mb-3">
      <div className="bg-gray-800 text-gray-100 rounded-2xl rounded-bl-sm px-4 py-2 max-w-[85%] prose prose-invert prose-sm">
        <ReactMarkdown
          components={{
            table: ({ children }) => (
              <div className="overflow-x-auto my-2">
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

// --- Welcome Screen ---
function WelcomeScreen({ onSelect }: { onSelect: (text: string) => void }) {
  const templates = [
    { icon: "📖", title: "小说改短剧", desc: "上传小说文本，改编成多集视频短剧", prompt: "帮我把我上传的故事改编成5集×15秒的短视频剧" },
    { icon: "📝", title: "故事大纲→剧本", desc: "提供故事概念，生成完整剧本和分镜", prompt: "我有一个故事概念，帮我开发成完整的剧本和分镜脚本" },
    { icon: "🎞️", title: "单集分镜生成", desc: "描述一个场景，直接生成Seedance分镜提示词", prompt: "帮我生成一个15秒的Seedance分镜提示词，场景是：" },
    { icon: "🔧", title: "优化已有提示词", desc: "粘贴你的Seedance提示词，按万能公式优化", prompt: "帮我优化以下Seedance分镜提示词：\n\n" },
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-4">
      <span className="text-5xl">🎬</span>
      <p className="text-lg text-gray-300">SeedanceChat — AI 视频脚本创作助手</p>
      <p className="text-sm">描述你想创作的视频内容，或选择一个模板开始</p>
      <div className="grid grid-cols-2 gap-3 mt-4 max-w-md">
        {templates.map((t) => (
          <button
            key={t.title}
            onClick={() => onSelect(t.prompt)}
            className="bg-gray-800/60 hover:bg-gray-700/60 rounded-xl px-4 py-3 text-left transition-colors border border-gray-700/50 hover:border-gray-600"
          >
            <span className="text-lg">{t.icon}</span>
            <p className="text-sm text-gray-200 mt-1">{t.title}</p>
            <p className="text-xs text-gray-500 mt-0.5">{t.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// --- Main App ---
export default function App() {
  const { messages, sendMessage, isConnected, isThinking } = useWebSocket();
  const { uploading, uploadedFiles, upload, clearFiles } = useFileUpload();
  const [input, setInput] = useState("");
  const [outputFiles, setOutputFiles] = useState<GeneratedFile[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    } catch { /* ignore */ }
  }, []);

  // Auto-refresh output files when new messages arrive
  useEffect(() => {
    refreshOutputFiles();
  }, [messages, refreshOutputFiles]);

  const handleSend = useCallback((text?: string) => {
    const content = text || input.trim();
    if (!content && !uploadedFiles.length) return;
    sendMessage(content, uploadedFiles.length ? uploadedFiles : undefined);
    setInput("");
    clearFiles();
  }, [input, uploadedFiles, sendMessage, clearFiles]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      await upload(file);
    }
  };

  return (
    <div className="h-screen flex bg-gray-950 text-gray-100">
      {/* Sidebar */}
      <FileSidebar files={outputFiles} onRefresh={refreshOutputFiles} />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-900 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎬</span>
            <h1 className="text-lg font-semibold">SeedanceChat</h1>
            <span className="text-xs text-gray-500">AI 视频脚本创作助手</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-400" : "bg-red-400"}`} />
            <span className="text-xs text-gray-500">{isConnected ? "已连接" : "断开"}</span>
          </div>
        </header>

        {/* Messages */}
        <main className="flex-1 overflow-y-auto px-4 py-4">
          {messages.length === 0 ? (
            <WelcomeScreen onSelect={handleSend} />
          ) : (
            messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} />
            ))
          )}
          {isThinking && (
            <div className="flex justify-start mb-2">
              <div className="bg-gray-800 rounded-2xl px-4 py-2 text-gray-400 text-sm flex items-center gap-2">
                <span className="inline-block w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                创作中...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </main>

        {/* Uploaded files indicator */}
        {uploadedFiles.length > 0 && (
          <div className="px-4 py-2 bg-gray-900 border-t border-gray-800 flex items-center gap-2 flex-wrap">
            {uploadedFiles.map((f) => (
              <span key={f.path} className="bg-gray-700 rounded-lg px-2 py-1 text-xs text-gray-300">
                📎 {f.name}
              </span>
            ))}
            <button onClick={clearFiles} className="text-xs text-red-400 hover:text-red-300 ml-2">
              清除
            </button>
          </div>
        )}

        {/* Input */}
        <div className="px-4 py-3 border-t border-gray-800 bg-gray-900 shrink-0">
          <div className="flex items-end gap-2">
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".txt,.md,.doc,.docx"
              multiple
              onChange={(e) => handleFileSelect(e.target.files)}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors"
              title="上传故事文本"
            >
              {uploading ? "⏳" : "📎"}
            </button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="描述你想创作的视频内容..."
              rows={1}
              className="flex-1 bg-gray-800 text-gray-100 rounded-xl px-4 py-2 resize-none outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-500"
            />
            <button
              onClick={() => handleSend()}
              disabled={(!input.trim() && !uploadedFiles.length) || !isConnected}
              className="p-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 text-white transition-colors"
            >
              ➤
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

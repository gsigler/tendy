import { useState, useEffect, useRef, useCallback } from "react";
import Markdown from "react-markdown";
import {
  getSessions,
  getSession,
  sendMessage,
  parseStream,
  logout,
  type Session,
  type User,
} from "../lib/api";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatPageProps {
  user: User;
  onLogout: () => void;
}

export default function ChatPage({ user, onLogout }: ChatPageProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    loadSessions();
  }, []);

  async function loadSessions() {
    try {
      const s = await getSessions();
      setSessions(s);
    } catch {
      // ignore
    }
  }

  async function loadSession(id: string) {
    try {
      const data = await getSession(id);
      setMessages(
        data.messages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      );
      setCurrentSessionId(id);
      setSidebarOpen(false);
    } catch {
      // ignore
    }
  }

  function startNewChat() {
    setCurrentSessionId(null);
    setMessages([]);
    setSidebarOpen(false);
    inputRef.current?.focus();
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || streaming) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setStreaming(true);

    // Add placeholder for assistant
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const { response, sessionId } = await sendMessage(
        text,
        currentSessionId ?? undefined,
      );

      if (!currentSessionId) {
        setCurrentSessionId(sessionId);
      }

      await parseStream(response, (chunk) => {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: chunk };
          return updated;
        });
      });

      // Refresh sessions list
      loadSessions();
    } catch (err) {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: `Sorry, something went wrong: ${err instanceof Error ? err.message : "Unknown error"}`,
        };
        return updated;
      });
    } finally {
      setStreaming(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleLogout() {
    logout();
    onLogout();
  }

  return (
    <div className="h-full flex">
      {/* Sidebar overlay (mobile) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-30 w-72 bg-black/30 backdrop-blur-xl border-r border-white/[0.08] flex flex-col transition-transform lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Sidebar header */}
        <div className="p-4 border-b border-white/[0.08]">
          <button
            onClick={startNewChat}
            className="w-full flex items-center gap-2 px-4 py-2.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 rounded-xl transition text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New conversation
          </button>
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto p-2">
          {sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => loadSession(s.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition mb-0.5 ${
                currentSessionId === s.id
                  ? "bg-emerald-500/20 text-emerald-200"
                  : "text-emerald-300/60 hover:bg-white/[0.05] hover:text-emerald-200"
              }`}
            >
              <div className="truncate">
                {s.title || "Untitled"}
              </div>
            </button>
          ))}
        </div>

        {/* User info */}
        <div className="p-3 border-t border-white/[0.08]">
          <div className="flex items-center gap-2 px-2">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-300 text-xs font-bold">
              {user.name[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-emerald-200 truncate">
                {user.name}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="text-emerald-400/50 hover:text-red-400 transition p-1"
              title="Sign out"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Main chat area */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.08] bg-black/20 backdrop-blur-sm">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-emerald-300/70 hover:text-emerald-200 transition"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-sm">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
              </svg>
            </div>
            <span className="text-emerald-100 font-semibold text-sm">Tend</span>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-400/20 to-emerald-600/20 border border-emerald-500/20 flex items-center justify-center mb-6">
                  <svg className="w-10 h-10 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-emerald-100 mb-2">
                  Welcome to Tend
                </h2>
                <p className="text-emerald-300/50 max-w-sm text-sm leading-relaxed">
                  I'm your AI garden assistant. Ask me about planning your garden,
                  managing plantings, scheduling tasks, or anything garden-related.
                </p>
                <div className="flex flex-wrap gap-2 mt-6 justify-center">
                  {[
                    "Help me plan my garden",
                    "What should I plant in zone 7?",
                    "When to start tomato seeds?",
                  ].map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => {
                        setInput(prompt);
                        inputRef.current?.focus();
                      }}
                      className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300/70 text-xs rounded-full hover:bg-emerald-500/20 hover:text-emerald-200 transition"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex-shrink-0 flex items-center justify-center mt-0.5 shadow-sm">
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                    </svg>
                  </div>
                )}
                <div
                  className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-emerald-500 text-white rounded-br-md"
                      : "bg-white/[0.07] text-emerald-100 border border-white/[0.08] rounded-bl-md"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    msg.content ? (
                      <div className="message-content">
                        <Markdown>{msg.content}</Markdown>
                      </div>
                    ) : (
                      <div className="flex gap-1 py-1">
                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" style={{ animation: "pulse-dot 1.4s ease-in-out infinite" }} />
                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" style={{ animation: "pulse-dot 1.4s ease-in-out 0.2s infinite" }} />
                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" style={{ animation: "pulse-dot 1.4s ease-in-out 0.4s infinite" }} />
                      </div>
                    )
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input area */}
        <div className="border-t border-white/[0.08] bg-black/20 backdrop-blur-sm p-3 sm:p-4">
          <div className="max-w-3xl mx-auto">
            <div className="flex gap-2 items-end bg-white/[0.06] border border-white/[0.1] rounded-2xl px-4 py-2 focus-within:ring-2 focus-within:ring-emerald-500/40 focus-within:border-emerald-500/40 transition">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message Tend..."
                rows={1}
                className="flex-1 bg-transparent text-white placeholder-emerald-300/30 resize-none outline-none text-sm py-1.5 max-h-32"
                style={{
                  height: "auto",
                  minHeight: "24px",
                }}
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = "auto";
                  el.style.height = Math.min(el.scrollHeight, 128) + "px";
                }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || streaming}
                className="p-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white transition disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

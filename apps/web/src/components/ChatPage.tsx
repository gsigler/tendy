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
  type DebugEvent,
} from "../lib/api";
import SpaceGridCard from "./SpaceGridCard";
import GardenMapCard from "./GardenMapCard";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface RichDisplay { _displayType: string; [key: string]: any; }

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  failed?: boolean;
  richDisplays?: RichDisplay[];
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
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugEvents, setDebugEvents] = useState<DebugEvent[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const debugEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    debugEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [debugEvents]);

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
    setDebugEvents([]);

    // Collect rich displays from tool results during streaming
    const richDisplays: RichDisplay[] = [];

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

      await parseStream(
        response,
        (chunk) => {
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: "assistant",
              content: chunk,
              richDisplays: richDisplays.length > 0 ? [...richDisplays] : undefined,
            };
            return updated;
          });
        },
        (event) => {
          setDebugEvents((prev) => [...prev, event]);
          // Capture rich display results
          if (
            event.type === "tool_result" &&
            event.result &&
            typeof event.result === "object" &&
            "_displayType" in (event.result as Record<string, unknown>)
          ) {
            richDisplays.push(event.result as RichDisplay);
            // Update message immediately with the new display
            setMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = {
                ...updated[updated.length - 1],
                richDisplays: [...richDisplays],
              };
              return updated;
            });
          }
        },
      );

      // Check if we got an empty response (stream completed but no text)
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last.role === "assistant" && !last.content && !last.richDisplays?.length) {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...last,
            content: "I wasn't able to generate a response. This might be due to a configuration issue (like a missing API key) or a temporary problem. Please try again.",
            failed: true,
          };
          return updated;
        }
        return prev;
      });

      // Refresh sessions list
      loadSessions();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: `Something went wrong: ${errorMsg}. You can try again or start a new conversation.`,
          failed: true,
        };
        return updated;
      });
    } finally {
      setStreaming(false);
    }
  }

  function handleRetry() {
    // Remove the failed assistant message and resend the last user message
    setMessages((prev) => {
      const withoutFailed = prev.filter((m) => !m.failed);
      const lastUserMsg = [...withoutFailed].reverse().find((m) => m.role === "user");
      if (lastUserMsg) {
        // Remove the last user message too — handleSend will re-add it
        const withoutLast = withoutFailed.slice(0, -1);
        setMessages(withoutLast);
        setInput(lastUserMsg.content);
        setTimeout(() => handleSend(), 0);
      }
      return prev;
    });
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
                  className={`rounded-2xl text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "max-w-[85%] sm:max-w-[75%] bg-emerald-500 text-white rounded-br-md px-4 py-2.5"
                      : "max-w-[90%] sm:max-w-[85%] rounded-bl-md"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <>
                      {/* Rich display cards */}
                      {msg.richDisplays?.map((display, di) => (
                        <div key={di}>
                          {display._displayType === "space_grid" && (
                            <SpaceGridCard data={display as never} />
                          )}
                          {display._displayType === "garden_map" && (
                            <GardenMapCard data={display as never} />
                          )}
                        </div>
                      ))}
                      {/* Text content */}
                      {msg.content ? (
                        <div className="message-content bg-white/[0.07] text-emerald-100 border border-white/[0.08] rounded-2xl rounded-bl-md px-4 py-2.5">
                          <Markdown>{msg.content}</Markdown>
                        </div>
                      ) : !msg.richDisplays?.length ? (
                        <div className="bg-white/[0.07] border border-white/[0.08] rounded-2xl rounded-bl-md px-4 py-2.5">
                          <div className="flex gap-1 py-1">
                            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" style={{ animation: "pulse-dot 1.4s ease-in-out infinite" }} />
                            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" style={{ animation: "pulse-dot 1.4s ease-in-out 0.2s infinite" }} />
                            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" style={{ animation: "pulse-dot 1.4s ease-in-out 0.4s infinite" }} />
                          </div>
                        </div>
                      ) : null}
                      {msg.failed && (
                        <button
                          onClick={handleRetry}
                          className="mt-2 text-xs text-red-300 hover:text-red-200 flex items-center gap-1 transition"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                          </svg>
                          Retry
                        </button>
                      )}
                    </>
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

      {/* Debug panel */}
      {debugOpen && (
        <aside className="w-96 border-l border-white/[0.08] bg-black/40 backdrop-blur-xl flex flex-col max-h-full overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.08]">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Debug</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDebugEvents([])}
                className="text-xs text-emerald-400/50 hover:text-emerald-300 transition"
              >
                Clear
              </button>
              <button
                onClick={() => setDebugOpen(false)}
                className="text-emerald-400/50 hover:text-white transition"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2 font-mono text-xs">
            {debugEvents.length === 0 && (
              <div className="text-emerald-400/30 text-center py-8">
                Send a message to see agent activity
              </div>
            )}
            {debugEvents.map((event, i) => (
              <div
                key={i}
                className={`rounded-lg p-2.5 border ${
                  event.type === "tool_call"
                    ? "bg-blue-500/10 border-blue-500/20"
                    : event.type === "tool_result"
                      ? "bg-emerald-500/10 border-emerald-500/20"
                      : event.type === "step_finish"
                        ? "bg-purple-500/10 border-purple-500/20"
                        : "bg-white/[0.03] border-white/[0.05]"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider ${
                      event.type === "tool_call"
                        ? "text-blue-400"
                        : event.type === "tool_result"
                          ? "text-emerald-400"
                          : event.type === "step_finish"
                            ? "text-purple-400"
                            : "text-gray-400"
                    }`}
                  >
                    {event.type === "tool_call"
                      ? `CALL ${event.toolName}`
                      : event.type === "tool_result"
                        ? `RESULT ${event.toolName}`
                        : event.type}
                  </span>
                  <span className="text-[10px] text-emerald-400/30 ml-auto">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                {event.args !== undefined && (
                  <details className="mt-1">
                    <summary className="text-blue-300/60 cursor-pointer hover:text-blue-300 text-[11px]">
                      Arguments
                    </summary>
                    <pre className="mt-1 text-blue-200/70 whitespace-pre-wrap break-all leading-relaxed">
                      {JSON.stringify(event.args, null, 2)}
                    </pre>
                  </details>
                )}
                {event.result !== undefined && (
                  <details className="mt-1" open>
                    <summary className="text-emerald-300/60 cursor-pointer hover:text-emerald-300 text-[11px]">
                      Result
                    </summary>
                    <pre className="mt-1 text-emerald-200/70 whitespace-pre-wrap break-all leading-relaxed">
                      {JSON.stringify(event.result, null, 2)}
                    </pre>
                  </details>
                )}
                {event.content && event.args === undefined && event.result === undefined && (
                  <div className="text-gray-300/70 mt-0.5">{event.content}</div>
                )}
              </div>
            ))}
            <div ref={debugEndRef} />
          </div>
        </aside>
      )}

      {/* Debug toggle button */}
      {!debugOpen && (
        <button
          onClick={() => setDebugOpen(true)}
          className="fixed bottom-4 right-4 z-40 p-2.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-400 rounded-xl transition shadow-lg backdrop-blur-sm"
          title="Toggle debug panel"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 12.75c1.148 0 2.278.08 3.383.237 1.037.146 1.866.966 1.866 2.013 0 3.728-2.35 6.75-5.25 6.75S6.75 18.728 6.75 15c0-1.046.83-1.867 1.866-2.013A24.204 24.204 0 0112 12.75zm0 0c2.883 0 5.647.508 8.207 1.44a23.91 23.91 0 01-1.152-6.135 3.001 3.001 0 00-2.36-2.78 11.088 11.088 0 00-9.39 0 3.001 3.001 0 00-2.36 2.78 23.91 23.91 0 01-1.152 6.135A23.864 23.864 0 0112 12.75zM9.75 8.625a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          </svg>
          {debugEvents.length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-black text-[10px] font-bold rounded-full flex items-center justify-center">
              {debugEvents.length}
            </span>
          )}
        </button>
      )}
    </div>
  );
}

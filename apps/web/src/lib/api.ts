const API_BASE = "/api/v1";

function getToken(): string | null {
  return localStorage.getItem("token");
}

function setToken(token: string) {
  localStorage.setItem("token", token);
}

function clearToken() {
  localStorage.removeItem("token");
}

async function apiFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  // Auto-logout on expired/invalid token
  if (res.status === 401 && token) {
    clearToken();
    localStorage.removeItem("user");
    window.location.reload();
  }

  return res;
}

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Session {
  id: string;
  title: string | null;
  seasonId: string | null;
  createdAt: string;
  lastMessageAt: string | null;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export async function register(
  email: string,
  password: string,
  name: string,
): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name }),
  });
  if (!res.ok) {
    const body = await res.json();
    throw new Error(body.error || "Registration failed");
  }
  const data: AuthResponse = await res.json();
  setToken(data.token);
  return data;
}

export async function login(
  email: string,
  password: string,
): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const body = await res.json();
    throw new Error(body.error || "Login failed");
  }
  const data: AuthResponse = await res.json();
  setToken(data.token);
  return data;
}

export function logout() {
  clearToken();
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

export async function getSessions(): Promise<Session[]> {
  const res = await apiFetch("/chat/sessions");
  if (!res.ok) throw new Error("Failed to fetch sessions");
  return res.json();
}

export async function createSession(
  title?: string,
): Promise<Session> {
  const res = await apiFetch("/chat/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error("Failed to create session");
  return res.json();
}

export async function getSession(
  id: string,
): Promise<{ id: string; title: string; messages: Message[] }> {
  const res = await apiFetch(`/chat/sessions/${id}`);
  if (!res.ok) throw new Error("Failed to fetch session");
  return res.json();
}

export async function sendMessage(
  message: string,
  sessionId?: string,
): Promise<{ response: Response; sessionId: string }> {
  const res = await apiFetch("/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, sessionId }),
  });
  if (!res.ok) {
    const body = await res.json();
    throw new Error(body.error || "Chat request failed");
  }
  const sid = res.headers.get("X-Session-Id") || sessionId || "";
  return { response: res, sessionId: sid };
}

export interface DebugEvent {
  timestamp: number;
  type: "tool_call" | "tool_result" | "text" | "step_finish" | "raw";
  toolName?: string;
  args?: unknown;
  result?: unknown;
  content?: string;
}

export async function parseStream(
  response: Response,
  onChunk: (text: string) => void,
  onDebug?: (event: DebugEvent) => void,
): Promise<string> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let fullText = "";
  let buffer = "";

  // Track tool calls being built up
  const pendingToolCalls = new Map<string, { name: string; args: string }>();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop()!;

    for (const line of lines) {
      if (!line.trim()) continue;

      const colonIdx = line.indexOf(":");
      if (colonIdx === -1) continue;
      const typeCode = line.slice(0, colonIdx);
      const payload = line.slice(colonIdx + 1);

      try {
        switch (typeCode) {
          case "0": {
            // Text content
            const text = JSON.parse(payload);
            fullText += text;
            onChunk(fullText);
            break;
          }
          case "9": {
            // Tool call start: {"toolCallId":"...","toolName":"..."}
            const data = JSON.parse(payload);
            pendingToolCalls.set(data.toolCallId, {
              name: data.toolName,
              args: "",
            });
            onDebug?.({
              timestamp: Date.now(),
              type: "tool_call",
              toolName: data.toolName,
              content: `Calling ${data.toolName}...`,
            });
            break;
          }
          case "a": {
            // Tool call delta (args streaming): {"toolCallId":"...","argsTextDelta":"..."}
            const data = JSON.parse(payload);
            const pending = pendingToolCalls.get(data.toolCallId);
            if (pending) {
              pending.args += data.argsTextDelta;
            }
            break;
          }
          case "b": {
            // Tool result: {"toolCallId":"...","result":...}
            const data = JSON.parse(payload);
            const call = pendingToolCalls.get(data.toolCallId);
            let parsedArgs: unknown = null;
            try {
              parsedArgs = call ? JSON.parse(call.args) : null;
            } catch {
              parsedArgs = call?.args;
            }
            onDebug?.({
              timestamp: Date.now(),
              type: "tool_result",
              toolName: call?.name ?? "unknown",
              args: parsedArgs,
              result: data.result,
            });
            pendingToolCalls.delete(data.toolCallId);
            break;
          }
          case "e": {
            // Step finish
            const data = JSON.parse(payload);
            onDebug?.({
              timestamp: Date.now(),
              type: "step_finish",
              content: `Step finished: ${data.finishReason ?? "unknown"}`,
            });
            break;
          }
          default: {
            // Log unknown events for debugging
            onDebug?.({
              timestamp: Date.now(),
              type: "raw",
              content: line,
            });
            break;
          }
        }
      } catch {
        // Skip unparseable lines
      }
    }
  }

  return fullText;
}

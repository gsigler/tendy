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
  return fetch(`${API_BASE}${path}`, { ...options, headers });
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

export async function parseStream(
  response: Response,
  onChunk: (text: string) => void,
): Promise<string> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let fullText = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Parse AI SDK data stream format
    // Lines are formatted as: type:content\n
    const lines = buffer.split("\n");
    buffer = lines.pop()!;

    for (const line of lines) {
      if (!line.trim()) continue;
      // AI SDK format: 0:text for text chunks
      if (line.startsWith("0:")) {
        try {
          const text = JSON.parse(line.slice(2));
          fullText += text;
          onChunk(fullText);
        } catch {
          // Skip unparseable lines
        }
      }
    }
  }

  return fullText;
}

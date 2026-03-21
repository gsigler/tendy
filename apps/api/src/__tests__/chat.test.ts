import { describe, it, expect, vi, beforeEach } from "vitest";
import { app } from "../app.js";
import { cleanDb } from "./helpers.js";

// Mock the AI SDK — keep `tool` real, mock `streamText`
vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return {
    ...actual,
    streamText: vi.fn(() => ({
      toDataStreamResponse: () =>
        new Response("mocked stream", {
          headers: { "Content-Type": "text/event-stream" },
        }),
      text: Promise.resolve("mocked response"),
      usage: Promise.resolve({ promptTokens: 0, completionTokens: 0 }),
    })),
  };
});

async function getAuthToken(): Promise<string> {
  const res = await app.request("/api/v1/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: `chat-${Date.now()}@example.com`,
      password: "password123",
      name: "Chat User",
    }),
  });
  const body = await res.json();
  return body.token;
}

describe("POST /api/v1/chat", () => {
  beforeEach(async () => {
    await cleanDb();
  });

  it("returns 401 without auth header", async () => {
    const res = await app.request("/api/v1/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Hello" }),
    });

    expect(res.status).toBe(401);
  });

  it("returns 401 with invalid token", async () => {
    const res = await app.request("/api/v1/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer invalid-token",
      },
      body: JSON.stringify({ message: "Hello" }),
    });

    expect(res.status).toBe(401);
  });

  it("streams a response with valid auth and creates a session", async () => {
    const token = await getAuthToken();

    const res = await app.request("/api/v1/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message: "How do I grow tomatoes?" }),
    });

    expect(res.status).toBe(200);
    // Should return a session ID
    const sessionId = res.headers.get("X-Session-Id");
    expect(sessionId).toBeTypeOf("string");
  });

  it("returns 400 for missing message", async () => {
    const token = await getAuthToken();

    const res = await app.request("/api/v1/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
  });

  it("returns 400 for empty message", async () => {
    const token = await getAuthToken();

    const res = await app.request("/api/v1/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message: "" }),
    });

    expect(res.status).toBe(400);
  });

  it("returns 404 for non-existent session", async () => {
    const token = await getAuthToken();

    const res = await app.request("/api/v1/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        message: "Hello",
        sessionId: "00000000-0000-0000-0000-000000000000",
      }),
    });

    expect(res.status).toBe(404);
  });
});

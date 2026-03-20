import { describe, it, expect, vi, beforeEach } from "vitest";
import { app } from "../app.js";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
// Mock the AI SDK to avoid needing an OpenAI key
vi.mock("ai", () => ({
  streamText: vi.fn(() => ({
    toDataStreamResponse: () =>
      new Response("mocked stream", {
        headers: { "Content-Type": "text/event-stream" },
      }),
  })),
}));

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
    await db.delete(users);
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

  it("streams a response with valid auth", async () => {
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
});

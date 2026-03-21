import { describe, it, expect, beforeEach } from "vitest";
import { app } from "../app.js";
import { cleanDb } from "./helpers.js";

async function getAuthToken(): Promise<string> {
  const res = await app.request("/api/v1/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: `session-${Date.now()}@example.com`,
      password: "password123",
      name: "Session User",
    }),
  });
  const body = await res.json();
  return body.token;
}

describe("Session endpoints", () => {
  beforeEach(async () => {
    await cleanDb();
  });

  describe("POST /api/v1/chat/sessions", () => {
    it("creates a new session", async () => {
      const token = await getAuthToken();

      const res = await app.request("/api/v1/chat/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: "My garden plan" }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.id).toBeTypeOf("string");
      expect(body.title).toBe("My garden plan");
    });

    it("returns 401 without auth", async () => {
      const res = await app.request("/api/v1/chat/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/v1/chat/sessions", () => {
    it("lists sessions for the user", async () => {
      const token = await getAuthToken();

      // Create two sessions
      await app.request("/api/v1/chat/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: "Session 1" }),
      });
      await app.request("/api/v1/chat/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: "Session 2" }),
      });

      const res = await app.request("/api/v1/chat/sessions", {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveLength(2);
    });
  });

  describe("GET /api/v1/chat/sessions/:id", () => {
    it("returns session with messages", async () => {
      const token = await getAuthToken();

      const createRes = await app.request("/api/v1/chat/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: "Detail session" }),
      });
      const { id: sessionId } = await createRes.json();

      const res = await app.request(`/api/v1/chat/sessions/${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBe(sessionId);
      expect(body.title).toBe("Detail session");
      expect(body.messages).toBeInstanceOf(Array);
    });

    it("returns 404 for non-existent session", async () => {
      const token = await getAuthToken();

      const res = await app.request(
        "/api/v1/chat/sessions/00000000-0000-0000-0000-000000000000",
        { headers: { Authorization: `Bearer ${token}` } },
      );

      expect(res.status).toBe(404);
    });
  });
});

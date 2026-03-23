import { describe, it, expect, beforeEach } from "vitest";
import { app } from "../app.js";
import { cleanDb, registerUser, authHeaders } from "./helpers.js";

describe("API Keys routes", () => {
  let token: string;

  beforeEach(async () => {
    await cleanDb();
    token = await registerUser();
  });

  describe("POST /api/v1/api-keys", () => {
    it("creates an API key with tndy_ prefix", async () => {
      const res = await app.request("/api/v1/api-keys", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ name: "My CLI Key" }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.key).toMatch(/^tndy_/);
      expect(body.name).toBe("My CLI Key");
      expect(body.id).toBeTypeOf("string");
      expect(body.prefix).toBeTypeOf("string");
    });

    it("returns 400 when name is missing", async () => {
      const res = await app.request("/api/v1/api-keys", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("name is required");
    });

    it("returns 401 without auth", async () => {
      const res = await app.request("/api/v1/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "test" }),
      });

      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/v1/api-keys", () => {
    it("lists API keys showing prefix but not raw key", async () => {
      // Create a key first
      await app.request("/api/v1/api-keys", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ name: "Key 1" }),
      });

      const res = await app.request("/api/v1/api-keys", {
        headers: authHeaders(token),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body).toHaveLength(1);
      expect(body[0].name).toBe("Key 1");
      expect(body[0].prefix).toBeTypeOf("string");
      // Raw key should NOT be returned in list
      expect(body[0].key).toBeUndefined();
    });
  });

  describe("Auth with API key", () => {
    it("can authenticate with an API key as Bearer token", async () => {
      // Create an API key
      const createRes = await app.request("/api/v1/api-keys", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ name: "Auth Test Key" }),
      });
      const { key } = (await createRes.json()) as { key: string };

      // Use the API key to access another endpoint
      const res = await app.request("/api/v1/gardens", {
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
    });
  });

  describe("DELETE /api/v1/api-keys/:id", () => {
    it("revokes an API key and returns revokedAt", async () => {
      const createRes = await app.request("/api/v1/api-keys", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ name: "Revoke Me" }),
      });
      const { id, key } = (await createRes.json()) as { id: string; key: string };

      const res = await app.request(`/api/v1/api-keys/${id}`, {
        method: "DELETE",
        headers: authHeaders(token),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(body.revokedAt).toBeTypeOf("string");

      // Revoked key should be rejected
      const authRes = await app.request("/api/v1/gardens", {
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
      });
      expect(authRes.status).toBe(401);
    });

    it("returns 404 for non-existent key", async () => {
      const res = await app.request(
        "/api/v1/api-keys/00000000-0000-0000-0000-000000000000",
        {
          method: "DELETE",
          headers: authHeaders(token),
        },
      );

      expect(res.status).toBe(404);
    });
  });
});

import { describe, it, expect, beforeEach } from "vitest";
import { app } from "../app.js";
import { cleanDb } from "./helpers.js";

describe("Auth routes", () => {
  beforeEach(async () => {
    await cleanDb();
  });

  describe("POST /api/v1/auth/register", () => {
    it("registers a new user and returns token", async () => {
      const res = await app.request("/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "test@example.com",
          password: "password123",
          name: "Test User",
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.token).toBeTypeOf("string");
      expect(body.user.email).toBe("test@example.com");
      expect(body.user.name).toBe("Test User");
      expect(body.user.id).toBeTypeOf("string");
    });

    it("returns 409 for duplicate email", async () => {
      const payload = {
        email: "dup@example.com",
        password: "password123",
        name: "First",
      };

      await app.request("/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const res = await app.request("/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error).toBe("Email already registered");
    });

    it("returns 400 for invalid email", async () => {
      const res = await app.request("/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "not-an-email",
          password: "password123",
          name: "Test",
        }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("Invalid request");
    });

    it("returns 400 for short password", async () => {
      const res = await app.request("/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "test@example.com",
          password: "short",
          name: "Test",
        }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid JSON", async () => {
      const res = await app.request("/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not json",
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("Invalid JSON");
    });
  });

  describe("POST /api/v1/auth/login", () => {
    const testUser = {
      email: "login@example.com",
      password: "password123",
      name: "Login User",
    };

    beforeEach(async () => {
      await app.request("/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testUser),
      });
    });

    it("logs in with correct credentials", async () => {
      const res = await app.request("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testUser.email,
          password: testUser.password,
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.token).toBeTypeOf("string");
      expect(body.user.email).toBe(testUser.email);
      expect(body.user.name).toBe(testUser.name);
    });

    it("returns 401 for wrong password", async () => {
      const res = await app.request("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testUser.email,
          password: "wrongpassword",
        }),
      });

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe("Invalid email or password");
    });

    it("returns 401 for non-existent email", async () => {
      const res = await app.request("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "nobody@example.com",
          password: "password123",
        }),
      });

      expect(res.status).toBe(401);
    });

    it("returns 400 for invalid JSON", async () => {
      const res = await app.request("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not json",
      });

      expect(res.status).toBe(400);
    });
  });
});

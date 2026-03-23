import { Hono } from "hono";
import type { AuthEnv } from "../../middleware/auth.js";
import * as apiKeyService from "../../services/api-key.service.js";

export const apiKeysRoutes = new Hono<AuthEnv>();

// List all API keys for the current user
apiKeysRoutes.get("/", async (c) => {
  const userId = c.get("userId");
  const keys = await apiKeyService.list(userId);
  return c.json(keys);
});

// Create a new API key
apiKeysRoutes.post("/", async (c) => {
  const userId = c.get("userId");
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  const { name } = body as { name?: string };
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return c.json({ error: "name is required" }, 400);
  }

  const key = await apiKeyService.create(userId, name.trim());
  return c.json(key, 201);
});

// Revoke an API key
apiKeysRoutes.delete("/:keyId", async (c) => {
  const userId = c.get("userId");
  const keyId = c.req.param("keyId");
  const result = await apiKeyService.revoke(userId, keyId);
  if (!result) {
    return c.json({ error: "API key not found" }, 404);
  }
  return c.json({ ok: true, id: result.id, revokedAt: result.revokedAt });
});

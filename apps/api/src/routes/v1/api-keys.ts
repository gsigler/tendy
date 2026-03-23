import { Hono } from "hono";
import { z } from "zod";
import type { AuthEnv } from "../../middleware/auth.js";
import * as apiKeyService from "../../services/api-key.service.js";

export const apiKeysRoutes = new Hono<AuthEnv>();

const CreateApiKeySchema = z.object({
  name: z.string({ required_error: "name is required" }).min(1, "name is required"),
});

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

  const parsed = CreateApiKeySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "name is required" }, 400);
  }

  const key = await apiKeyService.create(userId, parsed.data.name.trim());
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

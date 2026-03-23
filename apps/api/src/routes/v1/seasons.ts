import { Hono } from "hono";
import type { AuthEnv } from "../../middleware/auth.js";
import { seasonService } from "../../services/index.js";

export const seasons = new Hono<AuthEnv>();

// Nested under /gardens/:gardenId/seasons
seasons.get("/gardens/:gardenId/seasons", async (c) => {
  const userId = c.get("userId");
  const gardenId = c.req.param("gardenId");
  const result = await seasonService.list(userId, gardenId);
  if ("error" in result) return c.json(result, 404);
  return c.json(result);
});

seasons.post("/gardens/:gardenId/seasons", async (c) => {
  const userId = c.get("userId");
  const gardenId = c.req.param("gardenId");
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  const result = await seasonService.create(userId, { ...(body as Record<string, unknown>), gardenId } as Parameters<typeof seasonService.create>[1]);
  if ("error" in result) return c.json(result, 404);
  return c.json(result, 201);
});

// Direct /seasons/:seasonId routes
seasons.get("/seasons/:seasonId", async (c) => {
  const userId = c.get("userId");
  const seasonId = c.req.param("seasonId");
  const result = await seasonService.get(userId, seasonId);
  if (!result) return c.json({ error: "Not found" }, 404);
  return c.json(result);
});

seasons.get("/seasons/:seasonId/summary", async (c) => {
  const userId = c.get("userId");
  const seasonId = c.req.param("seasonId");
  const result = await seasonService.getSummary(userId, seasonId);
  if ("error" in result) return c.json(result, 404);
  return c.json(result);
});

seasons.patch("/seasons/:seasonId", async (c) => {
  const userId = c.get("userId");
  const seasonId = c.req.param("seasonId");
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  const result = await seasonService.update(userId, seasonId, body as Parameters<typeof seasonService.update>[2]);
  if ("error" in result) return c.json(result, 404);
  return c.json(result);
});

seasons.delete("/seasons/:seasonId", async (c) => {
  const userId = c.get("userId");
  const seasonId = c.req.param("seasonId");
  const result = await seasonService.del(userId, seasonId);
  if ("error" in result) return c.json(result, 404);
  return c.json({ ok: true });
});

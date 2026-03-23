import { Hono } from "hono";
import type { AuthEnv } from "../../middleware/auth.js";
import { spaceService } from "../../services/index.js";

export const spaces = new Hono<AuthEnv>();

// Nested under /seasons/:seasonId/spaces
spaces.get("/seasons/:seasonId/spaces", async (c) => {
  const userId = c.get("userId");
  const seasonId = c.req.param("seasonId");
  const result = await spaceService.list(userId, seasonId);
  if ("error" in result) return c.json(result, 404);
  return c.json(result);
});

spaces.post("/seasons/:seasonId/spaces", async (c) => {
  const userId = c.get("userId");
  const seasonId = c.req.param("seasonId");
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  const result = await spaceService.create(userId, { ...(body as Record<string, unknown>), seasonId } as Parameters<typeof spaceService.create>[1]);
  if ("error" in result) return c.json(result, 404);
  return c.json(result, 201);
});

// Direct /spaces/:spaceId routes
spaces.get("/spaces/:spaceId", async (c) => {
  const userId = c.get("userId");
  const spaceId = c.req.param("spaceId");
  const result = await spaceService.get(userId, spaceId);
  if (!result) return c.json({ error: "Not found" }, 404);
  return c.json(result);
});

spaces.patch("/spaces/:spaceId", async (c) => {
  const userId = c.get("userId");
  const spaceId = c.req.param("spaceId");
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  const result = await spaceService.update(userId, spaceId, body as Parameters<typeof spaceService.update>[2]);
  if ("error" in result) return c.json(result, 404);
  return c.json(result);
});

spaces.delete("/spaces/:spaceId", async (c) => {
  const userId = c.get("userId");
  const spaceId = c.req.param("spaceId");
  const result = await spaceService.del(userId, spaceId);
  if ("error" in result) return c.json(result, 404);
  return c.json({ ok: true });
});

// Grid operations
spaces.get("/spaces/:spaceId/grid", async (c) => {
  const userId = c.get("userId");
  const spaceId = c.req.param("spaceId");
  const result = await spaceService.getGrid(userId, spaceId);
  if ("error" in result) return c.json(result, 404);
  return c.json(result);
});

spaces.post("/spaces/:spaceId/grid", async (c) => {
  const userId = c.get("userId");
  const spaceId = c.req.param("spaceId");
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  const result = await spaceService.placeOnGrid(userId, { ...(body as Record<string, unknown>), spaceId } as Parameters<typeof spaceService.placeOnGrid>[1]);
  if ("error" in result) return c.json(result, 404);
  return c.json(result, 201);
});

spaces.delete("/spaces/:spaceId/grid/:plantingId", async (c) => {
  const userId = c.get("userId");
  const spaceId = c.req.param("spaceId");
  const plantingId = c.req.param("plantingId");
  const result = await spaceService.removeFromGrid(userId, { spaceId, plantingId });
  if ("error" in result) return c.json(result, 404);
  return c.json({ ok: true });
});

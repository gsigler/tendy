import { Hono } from "hono";
import type { AuthEnv } from "../../middleware/auth.js";
import { eventService } from "../../services/index.js";

export const events = new Hono<AuthEnv>();

// Nested under /seasons/:seasonId/events
events.get("/seasons/:seasonId/events", async (c) => {
  const userId = c.get("userId");
  const seasonId = c.req.param("seasonId");
  const limitStr = c.req.query("limit");
  const limit = limitStr ? parseInt(limitStr, 10) : undefined;
  const result = await eventService.listRecent(userId, seasonId, limit);
  if ("error" in result) return c.json(result, 404);
  return c.json(result);
});

events.post("/seasons/:seasonId/events", async (c) => {
  const userId = c.get("userId");
  const seasonId = c.req.param("seasonId");
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  const result = await eventService.record(userId, { ...(body as Record<string, unknown>), seasonId } as Parameters<typeof eventService.record>[1]);
  if ("error" in result) return c.json(result, 404);
  return c.json(result, 201);
});

// Direct /events/:eventId routes
events.delete("/events/:eventId", async (c) => {
  const userId = c.get("userId");
  const eventId = c.req.param("eventId");
  const result = await eventService.del(userId, eventId);
  if ("error" in result) return c.json(result, 404);
  return c.json({ ok: true });
});

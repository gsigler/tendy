import { Hono } from "hono";
import { z } from "zod";
import type { AuthEnv } from "../../middleware/auth.js";
import { eventService } from "../../services/index.js";
import { EventType } from "@tendy/shared";

export const events = new Hono<AuthEnv>();

const RecordEventSchema = z.object({
  type: EventType,
  summary: z.string().min(1),
  plantingId: z.string().uuid().optional(),
  spaceId: z.string().uuid().optional(),
  data: z.record(z.unknown()).optional(),
});

const ListEventsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

// Nested under /seasons/:seasonId/events
events.get("/seasons/:seasonId/events", async (c) => {
  const userId = c.get("userId");
  const seasonId = c.req.param("seasonId");
  const parsed = ListEventsQuerySchema.safeParse({ limit: c.req.query("limit") });
  if (!parsed.success) {
    return c.json({ error: "limit must be an integer between 1 and 100" }, 400);
  }
  const result = await eventService.listRecent(userId, seasonId, parsed.data.limit);
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
  const parsed = RecordEventSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" }, 400);
  }
  const result = await eventService.record(userId, { ...parsed.data, seasonId });
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

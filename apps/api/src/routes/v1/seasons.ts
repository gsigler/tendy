import { Hono } from "hono";
import { z } from "zod";
import type { AuthEnv } from "../../middleware/auth.js";
import { seasonService } from "../../services/index.js";

export const seasons = new Hono<AuthEnv>();

const CreateSeasonSchema = z.object({
  year: z.number().int(),
  name: z.string().min(1),
  lastFrostDate: z.string().optional(),
  firstFrostDate: z.string().optional(),
});

const UpdateSeasonSchema = z.object({
  lastFrostDate: z.string().optional(),
  firstFrostDate: z.string().optional(),
  status: z.enum(["planning", "active", "complete"]).optional(),
});

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
  const parsed = CreateSeasonSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" }, 400);
  }
  const result = await seasonService.create(userId, { ...parsed.data, gardenId });
  if ("error" in result) return c.json(result, 404);
  return c.json(result, 201);
});

// Direct /seasons/:seasonId routes
seasons.get("/seasons/:seasonId", async (c) => {
  const userId = c.get("userId");
  const seasonId = c.req.param("seasonId");
  const result = await seasonService.get(userId, seasonId);
  if ("error" in result) return c.json(result, 404);
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
  const parsed = UpdateSeasonSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" }, 400);
  }
  const result = await seasonService.update(userId, seasonId, parsed.data);
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

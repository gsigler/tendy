import { Hono } from "hono";
import { z } from "zod";
import type { AuthEnv } from "../../middleware/auth.js";
import * as harvestService from "../../services/harvest.service.js";

export const harvestsRoutes = new Hono<AuthEnv>();

const CreateHarvestSchema = z.object({
  crop: z.string().min(1),
  variety: z.string().optional(),
  plantingId: z.string().uuid().optional(),
  spaceId: z.string().uuid().optional(),
  quantity: z.number().positive().optional(),
  quantityUnit: z.string().optional(),
  weightOz: z.number().positive().optional(),
  harvestedAt: z.string().optional(),
  quality: z.string().optional(),
  notes: z.string().optional(),
});

const UpdateHarvestSchema = z.object({
  quantity: z.number().positive().optional(),
  quantityUnit: z.string().optional(),
  weightOz: z.number().positive().optional(),
  harvestedAt: z.string().optional(),
  quality: z.string().optional(),
  notes: z.string().optional(),
});

// List harvests for a season
harvestsRoutes.get("/seasons/:seasonId/harvests", async (c) => {
  const userId = c.get("userId");
  const seasonId = c.req.param("seasonId");
  const result = await harvestService.list(userId, seasonId);
  if ("error" in result) return c.json(result, 404);
  return c.json(result);
});

// Get harvest summary (totals by crop) for a season
harvestsRoutes.get("/seasons/:seasonId/harvest-summary", async (c) => {
  const userId = c.get("userId");
  const seasonId = c.req.param("seasonId");
  const result = await harvestService.summary(userId, seasonId);
  if ("error" in result) return c.json(result, 404);
  return c.json(result);
});

// Get single harvest by ID
harvestsRoutes.get("/harvests/:harvestId", async (c) => {
  const userId = c.get("userId");
  const harvestId = c.req.param("harvestId");
  const result = await harvestService.get(userId, harvestId);
  if (!result || "error" in result) return c.json({ error: "Not found" }, 404);
  return c.json(result);
});

// Record a harvest
harvestsRoutes.post("/seasons/:seasonId/harvests", async (c) => {
  const userId = c.get("userId");
  const seasonId = c.req.param("seasonId");
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  const parsed = CreateHarvestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" }, 400);
  }
  const result = await harvestService.create(userId, { ...parsed.data, seasonId });
  if (result && "error" in result) return c.json(result, 404);
  return c.json(result, 201);
});

// Update a harvest
harvestsRoutes.patch("/harvests/:harvestId", async (c) => {
  const userId = c.get("userId");
  const harvestId = c.req.param("harvestId");
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  const parsed = UpdateHarvestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" }, 400);
  }
  const result = await harvestService.update(userId, harvestId, parsed.data);
  if (!result || "error" in result) return c.json({ error: "Not found" }, 404);
  return c.json(result);
});

// Delete a harvest
harvestsRoutes.delete("/harvests/:harvestId", async (c) => {
  const userId = c.get("userId");
  const harvestId = c.req.param("harvestId");
  const result = await harvestService.del(userId, harvestId);
  if (result && "error" in result) return c.json(result, 404);
  return c.json({ ok: true });
});

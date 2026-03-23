import { Hono } from "hono";
import type { AuthEnv } from "../../middleware/auth.js";
import * as harvestService from "../../services/harvest.service.js";

export const harvestsRoutes = new Hono<AuthEnv>();

// List harvests for a season
harvestsRoutes.get("/seasons/:seasonId/harvests", async (c) => {
  const userId = c.get("userId");
  const seasonId = c.req.param("seasonId");
  const result = await harvestService.list(userId, seasonId);
  if (result && "error" in result) return c.json(result, 404);
  return c.json(result);
});

// Get harvest summary (totals by crop) for a season
harvestsRoutes.get("/seasons/:seasonId/harvest-summary", async (c) => {
  const userId = c.get("userId");
  const seasonId = c.req.param("seasonId");
  const result = await harvestService.summary(userId, seasonId);
  if (result && "error" in result) return c.json(result, 404);
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
  const params = body as Record<string, unknown>;
  const result = await harvestService.create(userId, {
    seasonId,
    ...params,
    crop: params.crop as string,
  });
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
  const result = await harvestService.update(userId, harvestId, body as Record<string, unknown>);
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

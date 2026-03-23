import { Hono } from "hono";
import type { AuthEnv } from "../../middleware/auth.js";
import { plantingService } from "../../services/index.js";
import type { PlantingStage, HealthStatus } from "@tendy/shared";

export const plantings = new Hono<AuthEnv>();

// Nested under /seasons/:seasonId/plantings
plantings.get("/seasons/:seasonId/plantings", async (c) => {
  const userId = c.get("userId");
  const seasonId = c.req.param("seasonId");
  const stage = c.req.query("stage") as PlantingStage | undefined;
  const result = await plantingService.list(userId, seasonId, stage);
  if ("error" in result) return c.json(result, 404);
  return c.json(result);
});

plantings.post("/seasons/:seasonId/plantings", async (c) => {
  const userId = c.get("userId");
  const seasonId = c.req.param("seasonId");
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  const result = await plantingService.create(userId, { ...(body as Record<string, unknown>), seasonId } as Parameters<typeof plantingService.create>[1]);
  if ("error" in result) return c.json(result, 404);
  return c.json(result, 201);
});

// Direct /plantings/:plantingId routes
plantings.get("/plantings/:plantingId", async (c) => {
  const userId = c.get("userId");
  const plantingId = c.req.param("plantingId");
  const result = await plantingService.get(userId, plantingId);
  if (!result) return c.json({ error: "Not found" }, 404);
  return c.json(result);
});

plantings.patch("/plantings/:plantingId", async (c) => {
  const userId = c.get("userId");
  const plantingId = c.req.param("plantingId");
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  const result = await plantingService.update(userId, plantingId, body as Parameters<typeof plantingService.update>[2]);
  if ("error" in result) return c.json(result, 404);
  return c.json(result);
});

plantings.post("/plantings/:plantingId/advance-stage", async (c) => {
  const userId = c.get("userId");
  const plantingId = c.req.param("plantingId");
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  const { stage } = body as { stage: PlantingStage };
  const result = await plantingService.advanceStage(userId, plantingId, stage);
  if ("error" in result) return c.json(result, 404);
  return c.json(result);
});

plantings.post("/plantings/:plantingId/health", async (c) => {
  const userId = c.get("userId");
  const plantingId = c.req.param("plantingId");
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  const { health, reason } = body as { health: HealthStatus; reason?: string };
  const result = await plantingService.updateHealth(userId, plantingId, health, reason);
  if ("error" in result) return c.json(result, 404);
  return c.json(result);
});

plantings.post("/plantings/:plantingId/move", async (c) => {
  const userId = c.get("userId");
  const plantingId = c.req.param("plantingId");
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  const { spaceId } = body as { spaceId: string };
  const result = await plantingService.move(userId, plantingId, spaceId);
  if ("error" in result) return c.json(result, 404);
  return c.json(result);
});

plantings.delete("/plantings/:plantingId", async (c) => {
  const userId = c.get("userId");
  const plantingId = c.req.param("plantingId");
  const result = await plantingService.del(userId, plantingId);
  if ("error" in result) return c.json(result, 404);
  return c.json({ ok: true });
});

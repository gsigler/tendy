import { Hono } from "hono";
import { z } from "zod";
import type { AuthEnv } from "../../middleware/auth.js";
import { plantingService } from "../../services/index.js";
import { PlantingStage, HealthStatus, SourceType } from "@tendy/shared";

export const plantings = new Hono<AuthEnv>();

const CreatePlantingSchema = z.object({
  crop: z.string().min(1),
  variety: z.string().optional(),
  sourceType: SourceType.optional(),
  spaceId: z.string().uuid().optional(),
  quantity: z.number().int().positive().optional(),
  quantityUnit: z.string().optional(),
  notes: z.string().optional(),
});

const UpdatePlantingSchema = z.object({
  variety: z.string().optional(),
  quantity: z.number().int().positive().optional(),
  quantityUnit: z.string().optional(),
  notes: z.string().optional(),
});

const AdvanceStageSchema = z.object({
  stage: PlantingStage,
});

const UpdateHealthSchema = z.object({
  health: HealthStatus,
  reason: z.string().optional(),
});

const MoveSchema = z.object({
  spaceId: z.string().uuid(),
});

// Nested under /seasons/:seasonId/plantings
plantings.get("/seasons/:seasonId/plantings", async (c) => {
  const userId = c.get("userId");
  const seasonId = c.req.param("seasonId");
  const stageStr = c.req.query("stage");
  const stageParsed = stageStr ? PlantingStage.safeParse(stageStr) : null;
  const stage = stageParsed?.success ? stageParsed.data : undefined;
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
  const parsed = CreatePlantingSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" }, 400);
  }
  const result = await plantingService.create(userId, { ...parsed.data, seasonId });
  if ("error" in result) return c.json(result, 404);
  return c.json(result, 201);
});

// Direct /plantings/:plantingId routes
plantings.get("/plantings/:plantingId", async (c) => {
  const userId = c.get("userId");
  const plantingId = c.req.param("plantingId");
  const result = await plantingService.get(userId, plantingId);
  if ("error" in result) return c.json(result, 404);
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
  const parsed = UpdatePlantingSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" }, 400);
  }
  const result = await plantingService.update(userId, plantingId, parsed.data);
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
  const parsed = AdvanceStageSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" }, 400);
  }
  const result = await plantingService.advanceStage(userId, plantingId, parsed.data.stage);
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
  const parsed = UpdateHealthSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" }, 400);
  }
  const result = await plantingService.updateHealth(userId, plantingId, parsed.data.health, parsed.data.reason);
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
  const parsed = MoveSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" }, 400);
  }
  const result = await plantingService.move(userId, plantingId, parsed.data.spaceId);
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

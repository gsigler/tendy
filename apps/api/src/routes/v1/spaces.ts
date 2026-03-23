import { Hono } from "hono";
import { z } from "zod";
import type { AuthEnv } from "../../middleware/auth.js";
import { spaceService } from "../../services/index.js";

export const spaces = new Hono<AuthEnv>();

const SpaceTypeEnum = z.enum(["RaisedBed", "Tray", "Container", "RowBed", "Shelf", "HardeningArea"]);
const SunExposureEnum = z.enum(["full_sun", "partial_sun", "partial_shade", "full_shade"]);

const CreateSpaceSchema = z.object({
  name: z.string().min(1),
  type: SpaceTypeEnum,
  width: z.number().optional(),
  length: z.number().optional(),
  unit: z.enum(["ft", "in", "m"]).optional(),
  sunExposure: SunExposureEnum.optional(),
  posX: z.number().optional(),
  posY: z.number().optional(),
  notes: z.string().optional(),
});

const UpdateSpaceSchema = z.object({
  name: z.string().min(1).optional(),
  type: SpaceTypeEnum.optional(),
  width: z.number().optional(),
  length: z.number().optional(),
  posX: z.number().optional(),
  posY: z.number().optional(),
  sunExposure: SunExposureEnum.optional(),
  notes: z.string().optional(),
});

const PlaceOnGridSchema = z.object({
  plantingId: z.string().uuid(),
  cells: z.array(z.object({ row: z.number().int(), col: z.number().int() })).min(1),
});

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
  const parsed = CreateSpaceSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" }, 400);
  }
  const result = await spaceService.create(userId, { ...parsed.data, seasonId });
  if ("error" in result) return c.json(result, 404);
  return c.json(result, 201);
});

// Direct /spaces/:spaceId routes
spaces.get("/spaces/:spaceId", async (c) => {
  const userId = c.get("userId");
  const spaceId = c.req.param("spaceId");
  const result = await spaceService.get(userId, spaceId);
  if ("error" in result) return c.json(result, 404);
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
  const parsed = UpdateSpaceSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" }, 400);
  }
  const result = await spaceService.update(userId, spaceId, parsed.data);
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
  const parsed = PlaceOnGridSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" }, 400);
  }
  const result = await spaceService.placeOnGrid(userId, { ...parsed.data, spaceId });
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

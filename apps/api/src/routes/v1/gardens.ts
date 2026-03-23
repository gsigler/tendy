import { Hono } from "hono";
import { z } from "zod";
import type { AuthEnv } from "../../middleware/auth.js";
import { gardenService } from "../../services/index.js";

export const gardens = new Hono<AuthEnv>();

const CreateGardenSchema = z.object({
  name: z.string().min(1),
  location: z.string().optional(),
  hardinessZone: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

const UpdateGardenSchema = z.object({
  name: z.string().min(1).optional(),
  location: z.string().optional(),
  hardinessZone: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

gardens.get("/", async (c) => {
  const userId = c.get("userId");
  const result = await gardenService.list(userId);
  return c.json(result);
});

gardens.get("/:gardenId", async (c) => {
  const userId = c.get("userId");
  const gardenId = c.req.param("gardenId");
  const result = await gardenService.get(userId, gardenId);
  if ("error" in result) return c.json(result, 404);
  return c.json(result);
});

gardens.post("/", async (c) => {
  const userId = c.get("userId");
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  const parsed = CreateGardenSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" }, 400);
  }
  const result = await gardenService.create(userId, parsed.data);
  return c.json(result, 201);
});

gardens.patch("/:gardenId", async (c) => {
  const userId = c.get("userId");
  const gardenId = c.req.param("gardenId");
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  const parsed = UpdateGardenSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" }, 400);
  }
  const result = await gardenService.update(userId, gardenId, parsed.data);
  if ("error" in result) return c.json(result, 404);
  return c.json(result);
});

gardens.delete("/:gardenId", async (c) => {
  const userId = c.get("userId");
  const gardenId = c.req.param("gardenId");
  const result = await gardenService.del(userId, gardenId);
  if ("error" in result) return c.json(result, 404);
  return c.json({ ok: true });
});

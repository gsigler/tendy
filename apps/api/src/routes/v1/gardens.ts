import { Hono } from "hono";
import type { AuthEnv } from "../../middleware/auth.js";
import { gardenService } from "../../services/index.js";

export const gardens = new Hono<AuthEnv>();

gardens.get("/", async (c) => {
  const userId = c.get("userId");
  const result = await gardenService.list(userId);
  return c.json(result);
});

gardens.get("/:gardenId", async (c) => {
  const userId = c.get("userId");
  const gardenId = c.req.param("gardenId");
  const result = await gardenService.get(userId, gardenId);
  if (!result) return c.json({ error: "Not found" }, 404);
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
  const result = await gardenService.create(userId, body as Parameters<typeof gardenService.create>[1]);
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
  const result = await gardenService.update(userId, gardenId, body as Parameters<typeof gardenService.update>[2]);
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

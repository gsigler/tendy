import { Hono } from "hono";
import type { AuthEnv } from "../../middleware/auth.js";
import { catalogService } from "../../services/index.js";

export const catalog = new Hono<AuthEnv>();

catalog.get("/", async (c) => {
  const userId = c.get("userId");
  const q = c.req.query("q") ?? "";
  const result = await catalogService.search(userId, q);
  return c.json(result);
});

catalog.post("/", async (c) => {
  const userId = c.get("userId");
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  const result = await catalogService.create(userId, body as Parameters<typeof catalogService.create>[1]);
  return c.json(result, 201);
});

catalog.get("/:catalogId", async (c) => {
  const userId = c.get("userId");
  const catalogId = c.req.param("catalogId");
  const result = await catalogService.get(userId, catalogId);
  if ("error" in result) return c.json(result, 404);
  return c.json(result);
});

catalog.patch("/:catalogId", async (c) => {
  const userId = c.get("userId");
  const catalogId = c.req.param("catalogId");
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  const result = await catalogService.update(userId, catalogId, body as Parameters<typeof catalogService.update>[2]);
  if ("error" in result) return c.json(result, 404);
  return c.json(result);
});

catalog.delete("/:catalogId", async (c) => {
  const userId = c.get("userId");
  const catalogId = c.req.param("catalogId");
  await catalogService.del(userId, catalogId);
  return c.json({ ok: true });
});

import { Hono } from "hono";
import { z } from "zod";
import type { AuthEnv } from "../../middleware/auth.js";
import { catalogService } from "../../services/index.js";
import { SourceType } from "@tendy/shared";

export const catalog = new Hono<AuthEnv>();

const SunEnum = z.enum(["full_sun", "partial_sun", "partial_shade", "full_shade"]);

const CreateCatalogSchema = z.object({
  crop: z.string().min(1),
  variety: z.string().optional(),
  vendor: z.string().optional(),
  sourceType: SourceType.optional(),
  daysToMaturity: z.number().int().positive().optional(),
  startIndoorsWeeks: z.number().int().positive().optional(),
  minNightTemp: z.number().int().optional(),
  spacingInches: z.number().int().positive().optional(),
  plantsPerSquare: z.number().int().positive().optional(),
  sun: SunEnum.optional(),
  growthHabit: z.string().optional(),
  notes: z.string().optional(),
});

const UpdateCatalogSchema = z.object({
  vendor: z.string().optional(),
  sourceType: SourceType.optional(),
  daysToMaturity: z.number().int().positive().optional(),
  startIndoorsWeeks: z.number().int().positive().optional(),
  minNightTemp: z.number().int().optional(),
  spacingInches: z.number().int().positive().optional(),
  plantsPerSquare: z.number().int().positive().optional(),
  sun: SunEnum.optional(),
  growthHabit: z.string().optional(),
  rating: z.number().int().min(1).max(5).optional(),
  wouldGrowAgain: z.number().int().min(0).max(1).optional(),
  yieldNotes: z.string().optional(),
  notes: z.string().optional(),
});

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
  const parsed = CreateCatalogSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" }, 400);
  }
  const result = await catalogService.create(userId, parsed.data);
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
  const parsed = UpdateCatalogSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" }, 400);
  }
  const result = await catalogService.update(userId, catalogId, parsed.data);
  if ("error" in result) return c.json(result, 404);
  return c.json(result);
});

catalog.delete("/:catalogId", async (c) => {
  const userId = c.get("userId");
  const catalogId = c.req.param("catalogId");
  await catalogService.del(userId, catalogId);
  return c.json({ ok: true });
});

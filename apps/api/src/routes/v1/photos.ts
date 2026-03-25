import { Hono } from "hono";
import { z } from "zod";
import type { AuthEnv } from "../../middleware/auth.js";
import * as photoService from "../../services/photo.service.js";

export const photosRoutes = new Hono<AuthEnv>();

const AttachTargetSchema = z.object({
  seasonId: z.string().uuid().optional(),
  plantingId: z.string().uuid().optional(),
  harvestId: z.string().uuid().optional(),
  spaceId: z.string().uuid().optional(),
  catalogId: z.string().uuid().optional(),
});

const RequestUploadSchema = AttachTargetSchema.extend({
  contentType: z.string().optional(),
  caption: z.string().optional(),
  takenAt: z.string().optional(),
});

const AttachUrlSchema = AttachTargetSchema.extend({
  url: z.string().url(),
  caption: z.string().optional(),
  takenAt: z.string().optional(),
});

const UpdatePhotoSchema = z.object({
  caption: z.string().optional(),
  takenAt: z.string().optional(),
});

const ListQuerySchema = z.object({
  seasonId: z.string().uuid().optional(),
  plantingId: z.string().uuid().optional(),
  harvestId: z.string().uuid().optional(),
  spaceId: z.string().uuid().optional(),
  catalogId: z.string().uuid().optional(),
});

// Request a presigned upload URL (direct-to-R2)
photosRoutes.post("/photos/upload-url", async (c) => {
  const userId = c.get("userId");
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  const parsed = RequestUploadSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" }, 400);
  }
  const result = await photoService.requestUploadUrl(userId, parsed.data);
  if ("error" in result) {
    const status = result.error?.startsWith("Storage not configured") ? 503 : 404;
    return c.json(result, status);
  }
  return c.json(result, 201);
});

// Attach an external photo URL
photosRoutes.post("/photos", async (c) => {
  const userId = c.get("userId");
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  const parsed = AttachUrlSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" }, 400);
  }
  const result = await photoService.attachUrl(userId, parsed.data);
  if ("error" in result) return c.json(result, 404);
  return c.json(result, 201);
});

// List photos for an entity
photosRoutes.get("/photos", async (c) => {
  const userId = c.get("userId");
  const parsed = ListQuerySchema.safeParse({
    seasonId: c.req.query("seasonId"),
    plantingId: c.req.query("plantingId"),
    harvestId: c.req.query("harvestId"),
    spaceId: c.req.query("spaceId"),
    catalogId: c.req.query("catalogId"),
  });
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Invalid query params" }, 400);
  }
  const result = await photoService.list(userId, parsed.data);
  if ("error" in result) return c.json(result, 400);
  return c.json(result);
});

// Get a single photo (url is a fresh presigned GET URL for bucket-backed photos)
photosRoutes.get("/photos/:photoId", async (c) => {
  const userId = c.get("userId");
  const photoId = c.req.param("photoId");
  const result = await photoService.get(userId, photoId);
  if (!result) return c.json({ error: "Not found" }, 404);
  return c.json(result);
});

// Get a fresh presigned download URL for a photo
photosRoutes.get("/photos/:photoId/url", async (c) => {
  const userId = c.get("userId");
  const photoId = c.req.param("photoId");
  const expiresIn = Number(c.req.query("expiresIn")) || 3600;
  const result = await photoService.getUrl(userId, photoId, expiresIn);
  if ("error" in result) {
    const status = result.error === "Photo not found" ? 404 : 503;
    return c.json(result, status);
  }
  return c.json(result);
});

// Update a photo's caption or takenAt
photosRoutes.patch("/photos/:photoId", async (c) => {
  const userId = c.get("userId");
  const photoId = c.req.param("photoId");
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  const parsed = UpdatePhotoSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" }, 400);
  }
  const result = await photoService.update(userId, photoId, parsed.data);
  if (!result || "error" in result) return c.json({ error: "Not found" }, 404);
  return c.json(result);
});

// Delete a photo
photosRoutes.delete("/photos/:photoId", async (c) => {
  const userId = c.get("userId");
  const photoId = c.req.param("photoId");
  const result = await photoService.del(userId, photoId);
  if (result && "error" in result) return c.json(result, 404);
  return c.json({ ok: true });
});

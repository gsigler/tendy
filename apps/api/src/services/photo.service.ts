import { eq, and, desc, or } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  photos,
  seasons,
  gardens,
  plantings,
  harvests,
  spaces,
  catalogEntries,
} from "../db/schema.js";
import * as storage from "./storage.service.js";

// ── Types ───────────────────────────────────────────────────────────────────

interface AttachTarget {
  seasonId?: string;
  plantingId?: string;
  harvestId?: string;
  spaceId?: string;
  catalogId?: string;
}

type PhotoRow = typeof photos.$inferSelect;

// ── Ownership helpers ───────────────────────────────────────────────────────

async function verifyPhotoOwnership(
  userId: string,
  photoId: string,
): Promise<boolean> {
  const [photo] = await db
    .select({ userId: photos.userId })
    .from(photos)
    .where(eq(photos.id, photoId))
    .limit(1);
  return !!photo && photo.userId === userId;
}

async function verifySeasonOwnership(
  userId: string,
  seasonId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ userId: gardens.userId })
    .from(seasons)
    .innerJoin(gardens, eq(seasons.gardenId, gardens.id))
    .where(and(eq(seasons.id, seasonId), eq(gardens.userId, userId)))
    .limit(1);
  return !!row;
}

async function verifyPlantingOwnership(
  userId: string,
  plantingId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ userId: gardens.userId })
    .from(plantings)
    .innerJoin(seasons, eq(plantings.seasonId, seasons.id))
    .innerJoin(gardens, eq(seasons.gardenId, gardens.id))
    .where(and(eq(plantings.id, plantingId), eq(gardens.userId, userId)))
    .limit(1);
  return !!row;
}

async function verifyHarvestOwnership(
  userId: string,
  harvestId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ userId: gardens.userId })
    .from(harvests)
    .innerJoin(seasons, eq(harvests.seasonId, seasons.id))
    .innerJoin(gardens, eq(seasons.gardenId, gardens.id))
    .where(and(eq(harvests.id, harvestId), eq(gardens.userId, userId)))
    .limit(1);
  return !!row;
}

async function verifySpaceOwnership(
  userId: string,
  spaceId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ userId: gardens.userId })
    .from(spaces)
    .innerJoin(seasons, eq(spaces.seasonId, seasons.id))
    .innerJoin(gardens, eq(seasons.gardenId, gardens.id))
    .where(and(eq(spaces.id, spaceId), eq(gardens.userId, userId)))
    .limit(1);
  return !!row;
}

async function verifyCatalogOwnership(
  userId: string,
  catalogId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ userId: catalogEntries.userId })
    .from(catalogEntries)
    .where(
      and(eq(catalogEntries.id, catalogId), eq(catalogEntries.userId, userId)),
    )
    .limit(1);
  return !!row;
}

/**
 * Validate that the requesting user owns every provided attachment target.
 * Returns an error string if any check fails, null if all pass.
 */
async function validateTargets(
  userId: string,
  targets: AttachTarget,
): Promise<string | null> {
  if (
    targets.seasonId &&
    !(await verifySeasonOwnership(userId, targets.seasonId))
  )
    return "Season not found";
  if (
    targets.plantingId &&
    !(await verifyPlantingOwnership(userId, targets.plantingId))
  )
    return "Planting not found";
  if (
    targets.harvestId &&
    !(await verifyHarvestOwnership(userId, targets.harvestId))
  )
    return "Harvest not found";
  if (
    targets.spaceId &&
    !(await verifySpaceOwnership(userId, targets.spaceId))
  )
    return "Space not found";
  if (
    targets.catalogId &&
    !(await verifyCatalogOwnership(userId, targets.catalogId))
  )
    return "Catalog entry not found";
  return null;
}

/**
 * For Railway-backed photos (storageKey set), generate a fresh presigned GET
 * URL and substitute it for the raw storage key stored in the url column.
 * For external-URL photos (storageKey null), the url field is returned as-is.
 */
async function enrichUrl(photo: PhotoRow): Promise<PhotoRow> {
  if (photo.storageKey && storage.isConfigured()) {
    try {
      const signedUrl = await storage.createDownloadUrl(photo.storageKey);
      return { ...photo, url: signedUrl };
    } catch {
      // If presigning fails (e.g. misconfigured creds) return the key as-is
    }
  }
  return photo;
}

async function enrichUrls(rows: PhotoRow[]): Promise<PhotoRow[]> {
  return Promise.all(rows.map(enrichUrl));
}

// ── Public service functions ────────────────────────────────────────────────

/**
 * Request a presigned PUT URL for direct-to-bucket upload.
 * Creates a photo record immediately so the ID is known before the upload.
 * The `url` field in the response is a presigned GET URL valid for 1 hour.
 */
export async function requestUploadUrl(
  userId: string,
  params: {
    contentType?: string;
    caption?: string;
    takenAt?: string;
  } & AttachTarget,
) {
  if (!storage.isConfigured()) {
    return {
      error:
        "Storage not configured. Attach a Railway Bucket and ensure ACCESS_KEY_ID, SECRET_ACCESS_KEY, BUCKET, and ENDPOINT are set." as const,
    };
  }

  const err = await validateTargets(userId, params);
  if (err) return { error: err as string };

  const key = `photos/${userId}/${crypto.randomUUID()}`;
  const [uploadUrl, downloadUrl] = await Promise.all([
    storage.createUploadUrl(key, params.contentType ?? "image/jpeg"),
    storage.createDownloadUrl(key),
  ]);

  const [photo] = await db
    .insert(photos)
    .values({
      userId,
      seasonId: params.seasonId,
      plantingId: params.plantingId,
      harvestId: params.harvestId,
      spaceId: params.spaceId,
      catalogId: params.catalogId,
      storageKey: key,
      // Store the raw key; enrichUrl() regenerates a signed URL on each read.
      // We return a fresh signed URL in this response for immediate use.
      url: key,
      caption: params.caption,
      takenAt: params.takenAt ? new Date(params.takenAt) : new Date(),
    })
    .returning();

  return {
    photoId: photo.id,
    uploadUrl,
    uploadExpiresIn: 900,
    url: downloadUrl,
    urlExpiresIn: 3600,
  };
}

/**
 * Attach an externally-hosted photo URL (no bucket upload needed).
 */
export async function attachUrl(
  userId: string,
  params: {
    url: string;
    caption?: string;
    takenAt?: string;
  } & AttachTarget,
) {
  const err = await validateTargets(userId, params);
  if (err) return { error: err as string };

  const [photo] = await db
    .insert(photos)
    .values({
      userId,
      seasonId: params.seasonId,
      plantingId: params.plantingId,
      harvestId: params.harvestId,
      spaceId: params.spaceId,
      catalogId: params.catalogId,
      storageKey: null,
      url: params.url,
      caption: params.caption,
      takenAt: params.takenAt ? new Date(params.takenAt) : new Date(),
    })
    .returning();

  return photo;
}

/**
 * List photos for a given entity. Provide at least one filter ID.
 * Railway-backed photos have their url replaced with a fresh presigned GET URL.
 */
export async function list(
  userId: string,
  filter: {
    seasonId?: string;
    plantingId?: string;
    harvestId?: string;
    spaceId?: string;
    catalogId?: string;
  },
) {
  const err = await validateTargets(userId, filter);
  if (err) return { error: err as string };

  const conditions = [];
  if (filter.seasonId) conditions.push(eq(photos.seasonId, filter.seasonId));
  if (filter.plantingId)
    conditions.push(eq(photos.plantingId, filter.plantingId));
  if (filter.harvestId) conditions.push(eq(photos.harvestId, filter.harvestId));
  if (filter.spaceId) conditions.push(eq(photos.spaceId, filter.spaceId));
  if (filter.catalogId) conditions.push(eq(photos.catalogId, filter.catalogId));

  if (conditions.length === 0) {
    return {
      error:
        "At least one filter (seasonId, plantingId, harvestId, spaceId, catalogId) is required" as string,
    };
  }

  const whereClause =
    conditions.length === 1 ? conditions[0] : or(...conditions);

  const rows = await db
    .select()
    .from(photos)
    .where(and(eq(photos.userId, userId), whereClause))
    .orderBy(desc(photos.takenAt));

  return enrichUrls(rows);
}

export async function get(userId: string, photoId: string) {
  if (!(await verifyPhotoOwnership(userId, photoId))) return null;
  const [photo] = await db
    .select()
    .from(photos)
    .where(eq(photos.id, photoId))
    .limit(1);
  if (!photo) return null;
  return enrichUrl(photo);
}

/**
 * Generate a fresh presigned GET URL for a Railway-backed photo.
 * Returns the external URL as-is for non-storage photos.
 */
export async function getUrl(
  userId: string,
  photoId: string,
  expiresIn = 3600,
) {
  if (!(await verifyPhotoOwnership(userId, photoId))) {
    return { error: "Photo not found" as const };
  }
  const [photo] = await db
    .select({ storageKey: photos.storageKey, url: photos.url })
    .from(photos)
    .where(eq(photos.id, photoId))
    .limit(1);
  if (!photo) return { error: "Photo not found" as const };

  if (!photo.storageKey) {
    return { url: photo.url, expiresIn: null };
  }

  if (!storage.isConfigured()) {
    return { error: "Storage not configured" as const };
  }

  const url = await storage.createDownloadUrl(photo.storageKey, expiresIn);
  return { url, expiresIn };
}

/**
 * Update a photo's caption or takenAt.
 */
export async function update(
  userId: string,
  photoId: string,
  params: { caption?: string; takenAt?: string },
) {
  if (!(await verifyPhotoOwnership(userId, photoId))) {
    return { error: "Photo not found" as const };
  }

  const updates: Record<string, unknown> = {};
  if (params.caption !== undefined) updates.caption = params.caption;
  if (params.takenAt !== undefined) updates.takenAt = new Date(params.takenAt);

  if (Object.keys(updates).length === 0) return get(userId, photoId);

  const [photo] = await db
    .update(photos)
    .set(updates)
    .where(eq(photos.id, photoId))
    .returning();

  if (!photo) return null;
  return enrichUrl(photo);
}

/**
 * Delete a photo. If it was uploaded to storage, also removes it from the bucket.
 */
export async function del(userId: string, photoId: string) {
  const [photo] = await db
    .select({ userId: photos.userId, storageKey: photos.storageKey })
    .from(photos)
    .where(eq(photos.id, photoId))
    .limit(1);

  if (!photo || photo.userId !== userId) {
    return { error: "Photo not found" as const };
  }

  if (photo.storageKey && storage.isConfigured()) {
    try {
      await storage.deleteObject(photo.storageKey);
    } catch (e) {
      console.error("[photo] storage delete failed:", e);
    }
  }

  await db.delete(photos).where(eq(photos.id, photoId));
}

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { app } from "../app.js";
import {
  cleanDb,
  registerUser,
  authHeaders,
  createGarden,
  createSeason,
  createSpace,
  createPlanting,
  createHarvest,
  createCatalogEntry,
  attachPhoto,
} from "./helpers.js";

// Mock the storage service so tests don't need real Railway Bucket credentials
vi.mock("../services/storage.service.js", () => ({
  isConfigured: vi.fn(() => true),
  createUploadUrl: vi.fn(async () => "https://upload.example.com/presigned"),
  createDownloadUrl: vi.fn(async (key: string) => `https://download.example.com/${key}`),
  deleteObject: vi.fn(async () => undefined),
}));

describe("Photos", () => {
  let token: string;
  let seasonId: string;
  let plantingId: string;
  let spaceId: string;
  let harvestId: string;
  let catalogId: string;

  beforeEach(async () => {
    await cleanDb();
    token = await registerUser();
    const gardenId = await createGarden(token);
    seasonId = await createSeason(token, gardenId);
    spaceId = await createSpace(token, seasonId);
    plantingId = await createPlanting(token, seasonId);
    harvestId = await createHarvest(token, seasonId);
    catalogId = await createCatalogEntry(token);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ── POST /api/v1/photos (attach external URL) ───────────────────────────

  describe("POST /api/v1/photos", () => {
    it("attaches a photo by URL to a season", async () => {
      const res = await app.request("/api/v1/photos", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          url: "https://example.com/photo.jpg",
          seasonId,
          caption: "Garden progress",
        }),
      });
      expect(res.status).toBe(201);
      const data = await res.json() as Record<string, unknown>;
      expect(data.id).toBeDefined();
      expect(data.url).toBe("https://example.com/photo.jpg");
      expect(data.seasonId).toBe(seasonId);
      expect(data.caption).toBe("Garden progress");
      expect(data.storageKey).toBeNull();
    });

    it("attaches a photo to a planting", async () => {
      const res = await app.request("/api/v1/photos", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          url: "https://example.com/seedling.jpg",
          plantingId,
        }),
      });
      expect(res.status).toBe(201);
      const data = await res.json() as Record<string, unknown>;
      expect(data.plantingId).toBe(plantingId);
    });

    it("attaches a photo to a harvest", async () => {
      const res = await app.request("/api/v1/photos", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          url: "https://example.com/harvest.jpg",
          harvestId,
          caption: "Big harvest day",
        }),
      });
      expect(res.status).toBe(201);
      const data = await res.json() as Record<string, unknown>;
      expect(data.harvestId).toBe(harvestId);
    });

    it("attaches a photo to a space", async () => {
      const res = await app.request("/api/v1/photos", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          url: "https://example.com/bed.jpg",
          spaceId,
        }),
      });
      expect(res.status).toBe(201);
      const data = await res.json() as Record<string, unknown>;
      expect(data.spaceId).toBe(spaceId);
    });

    it("attaches a photo to a catalog entry", async () => {
      const res = await app.request("/api/v1/photos", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          url: "https://example.com/seed-packet.jpg",
          catalogId,
        }),
      });
      expect(res.status).toBe(201);
      const data = await res.json() as Record<string, unknown>;
      expect(data.catalogId).toBe(catalogId);
    });

    it("can attach to multiple entities at once", async () => {
      const res = await app.request("/api/v1/photos", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          url: "https://example.com/multi.jpg",
          seasonId,
          plantingId,
          caption: "Planting in the bed",
        }),
      });
      expect(res.status).toBe(201);
      const data = await res.json() as Record<string, unknown>;
      expect(data.seasonId).toBe(seasonId);
      expect(data.plantingId).toBe(plantingId);
    });

    it("respects takenAt when provided", async () => {
      const takenAt = "2026-06-15T10:00:00.000Z";
      const res = await app.request("/api/v1/photos", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          url: "https://example.com/photo.jpg",
          seasonId,
          takenAt,
        }),
      });
      expect(res.status).toBe(201);
      const data = await res.json() as Record<string, unknown>;
      expect(new Date(data.takenAt as string).toISOString()).toBe(takenAt);
    });

    it("returns 400 for invalid URL", async () => {
      const res = await app.request("/api/v1/photos", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          url: "not-a-url",
          seasonId,
        }),
      });
      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid JSON", async () => {
      const res = await app.request("/api/v1/photos", {
        method: "POST",
        headers: authHeaders(token),
        body: "bad json",
      });
      expect(res.status).toBe(400);
    });

    it("returns 404 for non-existent season", async () => {
      const res = await app.request("/api/v1/photos", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          url: "https://example.com/photo.jpg",
          seasonId: "00000000-0000-0000-0000-000000000000",
        }),
      });
      expect(res.status).toBe(404);
    });

    it("returns 401 without auth", async () => {
      const res = await app.request("/api/v1/photos", {
        method: "POST",
        body: JSON.stringify({
          url: "https://example.com/photo.jpg",
          seasonId,
        }),
      });
      expect(res.status).toBe(401);
    });
  });

  // ── POST /api/v1/photos/upload-url (presigned upload) ──────────────────

  describe("POST /api/v1/photos/upload-url", () => {
    it("returns a presigned upload URL and photoId", async () => {
      const { isConfigured, createUploadUrl, createDownloadUrl } = await import(
        "../services/storage.service.js"
      );
      (isConfigured as ReturnType<typeof vi.fn>).mockReturnValue(true);
      (createUploadUrl as ReturnType<typeof vi.fn>).mockResolvedValue(
        "https://upload.example.com/presigned",
      );
      (createDownloadUrl as ReturnType<typeof vi.fn>).mockResolvedValue(
        "https://download.example.com/photos/user/uuid",
      );

      const res = await app.request("/api/v1/photos/upload-url", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          seasonId,
          caption: "Post-rain check",
          contentType: "image/jpeg",
        }),
      });
      expect(res.status).toBe(201);
      const data = await res.json() as Record<string, unknown>;
      expect(data.photoId).toBeDefined();
      expect(data.uploadUrl).toBe("https://upload.example.com/presigned");
      expect(data.uploadExpiresIn).toBe(900);
      expect(data.url).toBe("https://download.example.com/photos/user/uuid");
      expect(data.urlExpiresIn).toBe(3600);
    });

    it("returns 503 when storage is not configured", async () => {
      const { isConfigured } = await import("../services/storage.service.js");
      (isConfigured as ReturnType<typeof vi.fn>).mockReturnValue(false);

      const res = await app.request("/api/v1/photos/upload-url", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ seasonId }),
      });
      expect(res.status).toBe(503);
    });

    it("returns 401 without auth", async () => {
      const res = await app.request("/api/v1/photos/upload-url", {
        method: "POST",
        body: JSON.stringify({ seasonId }),
      });
      expect(res.status).toBe(401);
    });
  });

  // ── GET /api/v1/photos ──────────────────────────────────────────────────

  describe("GET /api/v1/photos", () => {
    it("lists photos for a season", async () => {
      await attachPhoto(token, "https://example.com/a.jpg", { seasonId });
      await attachPhoto(token, "https://example.com/b.jpg", { seasonId });

      const res = await app.request(
        `/api/v1/photos?seasonId=${seasonId}`,
        { headers: authHeaders(token) },
      );
      expect(res.status).toBe(200);
      const data = await res.json() as unknown[];
      expect(data).toHaveLength(2);
    });

    it("lists photos for a planting", async () => {
      await attachPhoto(token, "https://example.com/seedling.jpg", {
        plantingId,
      });

      const res = await app.request(
        `/api/v1/photos?plantingId=${plantingId}`,
        { headers: authHeaders(token) },
      );
      expect(res.status).toBe(200);
      const data = await res.json() as unknown[];
      expect(data).toHaveLength(1);
    });

    it("lists photos for a harvest", async () => {
      await attachPhoto(token, "https://example.com/harvest.jpg", {
        harvestId,
      });

      const res = await app.request(
        `/api/v1/photos?harvestId=${harvestId}`,
        { headers: authHeaders(token) },
      );
      expect(res.status).toBe(200);
      const data = await res.json() as unknown[];
      expect(data).toHaveLength(1);
    });

    it("lists photos for a space", async () => {
      await attachPhoto(token, "https://example.com/bed.jpg", { spaceId });

      const res = await app.request(
        `/api/v1/photos?spaceId=${spaceId}`,
        { headers: authHeaders(token) },
      );
      expect(res.status).toBe(200);
      const data = await res.json() as unknown[];
      expect(data).toHaveLength(1);
    });

    it("lists photos for a catalog entry", async () => {
      await attachPhoto(token, "https://example.com/seed.jpg", { catalogId });

      const res = await app.request(
        `/api/v1/photos?catalogId=${catalogId}`,
        { headers: authHeaders(token) },
      );
      expect(res.status).toBe(200);
      const data = await res.json() as unknown[];
      expect(data).toHaveLength(1);
    });

    it("returns empty array when no photos", async () => {
      const res = await app.request(
        `/api/v1/photos?seasonId=${seasonId}`,
        { headers: authHeaders(token) },
      );
      expect(res.status).toBe(200);
      const data = await res.json() as unknown[];
      expect(data).toHaveLength(0);
    });

    it("returns 400 with no filter", async () => {
      const res = await app.request("/api/v1/photos", {
        headers: authHeaders(token),
      });
      expect(res.status).toBe(400);
    });

    it("does not return another user's photos", async () => {
      const other = await registerUser("other@test.com", "password123", "Other");
      const otherGardenId = await createGarden(other);
      const otherSeasonId = await createSeason(other, otherGardenId);
      await attachPhoto(other, "https://example.com/other.jpg", {
        seasonId: otherSeasonId,
      });

      const res = await app.request(
        `/api/v1/photos?seasonId=${seasonId}`,
        { headers: authHeaders(token) },
      );
      expect(res.status).toBe(200);
      const data = await res.json() as unknown[];
      expect(data).toHaveLength(0);
    });
  });

  // ── GET /api/v1/photos/:photoId ─────────────────────────────────────────

  describe("GET /api/v1/photos/:photoId", () => {
    it("returns a photo by ID", async () => {
      const photoId = await attachPhoto(
        token,
        "https://example.com/photo.jpg",
        { seasonId },
      );

      const res = await app.request(`/api/v1/photos/${photoId}`, {
        headers: authHeaders(token),
      });
      expect(res.status).toBe(200);
      const data = await res.json() as Record<string, unknown>;
      expect(data.id).toBe(photoId);
    });

    it("returns 404 for non-existent photo", async () => {
      const res = await app.request(
        "/api/v1/photos/00000000-0000-0000-0000-000000000000",
        { headers: authHeaders(token) },
      );
      expect(res.status).toBe(404);
    });

    it("returns 404 for another user's photo", async () => {
      const other = await registerUser("other2@test.com", "password123", "Other2");
      const otherGardenId = await createGarden(other);
      const otherSeasonId = await createSeason(other, otherGardenId);
      const photoId = await attachPhoto(other, "https://example.com/p.jpg", {
        seasonId: otherSeasonId,
      });

      const res = await app.request(`/api/v1/photos/${photoId}`, {
        headers: authHeaders(token),
      });
      expect(res.status).toBe(404);
    });
  });

  // ── GET /api/v1/photos/:photoId/url ────────────────────────────────────

  describe("GET /api/v1/photos/:photoId/url", () => {
    it("returns the external url as-is for non-storage photos", async () => {
      const photoId = await attachPhoto(
        token,
        "https://example.com/photo.jpg",
        { seasonId },
      );

      const res = await app.request(`/api/v1/photos/${photoId}/url`, {
        headers: authHeaders(token),
      });
      expect(res.status).toBe(200);
      const data = await res.json() as Record<string, unknown>;
      expect(data.url).toBe("https://example.com/photo.jpg");
      expect(data.expiresIn).toBeNull();
    });

    it("returns a fresh presigned GET URL for a bucket-backed photo", async () => {
      const { createDownloadUrl } = await import("../services/storage.service.js");
      (createDownloadUrl as ReturnType<typeof vi.fn>).mockResolvedValue(
        "https://download.example.com/fresh-url",
      );

      // Create via upload-url to get a storageKey-backed photo
      const uploadRes = await app.request("/api/v1/photos/upload-url", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ seasonId }),
      });
      const uploadData = await uploadRes.json() as Record<string, unknown>;
      const photoId = uploadData.photoId as string;

      const res = await app.request(`/api/v1/photos/${photoId}/url`, {
        headers: authHeaders(token),
      });
      expect(res.status).toBe(200);
      const data = await res.json() as Record<string, unknown>;
      expect(data.url).toBe("https://download.example.com/fresh-url");
      expect(data.expiresIn).toBe(3600);
    });

    it("returns 404 for non-existent photo", async () => {
      const res = await app.request(
        "/api/v1/photos/00000000-0000-0000-0000-000000000000/url",
        { headers: authHeaders(token) },
      );
      expect(res.status).toBe(404);
    });
  });

  // ── PATCH /api/v1/photos/:photoId ───────────────────────────────────────

  describe("PATCH /api/v1/photos/:photoId", () => {
    it("updates caption", async () => {
      const photoId = await attachPhoto(
        token,
        "https://example.com/photo.jpg",
        { seasonId },
      );

      const res = await app.request(`/api/v1/photos/${photoId}`, {
        method: "PATCH",
        headers: authHeaders(token),
        body: JSON.stringify({ caption: "Updated caption" }),
      });
      expect(res.status).toBe(200);
      const data = await res.json() as Record<string, unknown>;
      expect(data.caption).toBe("Updated caption");
    });

    it("updates takenAt", async () => {
      const photoId = await attachPhoto(
        token,
        "https://example.com/photo.jpg",
        { seasonId },
      );
      const newDate = "2026-07-04T12:00:00.000Z";

      const res = await app.request(`/api/v1/photos/${photoId}`, {
        method: "PATCH",
        headers: authHeaders(token),
        body: JSON.stringify({ takenAt: newDate }),
      });
      expect(res.status).toBe(200);
      const data = await res.json() as Record<string, unknown>;
      expect(new Date(data.takenAt as string).toISOString()).toBe(newDate);
    });

    it("returns 404 for non-existent photo", async () => {
      const res = await app.request(
        "/api/v1/photos/00000000-0000-0000-0000-000000000000",
        {
          method: "PATCH",
          headers: authHeaders(token),
          body: JSON.stringify({ caption: "x" }),
        },
      );
      expect(res.status).toBe(404);
    });
  });

  // ── DELETE /api/v1/photos/:photoId ──────────────────────────────────────

  describe("DELETE /api/v1/photos/:photoId", () => {
    it("deletes a photo", async () => {
      const photoId = await attachPhoto(
        token,
        "https://example.com/photo.jpg",
        { seasonId },
      );

      const del = await app.request(`/api/v1/photos/${photoId}`, {
        method: "DELETE",
        headers: authHeaders(token),
      });
      expect(del.status).toBe(200);

      const get = await app.request(`/api/v1/photos/${photoId}`, {
        headers: authHeaders(token),
      });
      expect(get.status).toBe(404);
    });

    it("returns 404 for non-existent photo", async () => {
      const res = await app.request(
        "/api/v1/photos/00000000-0000-0000-0000-000000000000",
        {
          method: "DELETE",
          headers: authHeaders(token),
        },
      );
      expect(res.status).toBe(404);
    });

    it("returns 404 when deleting another user's photo", async () => {
      const other = await registerUser("other3@test.com", "password123", "Other3");
      const otherGardenId = await createGarden(other);
      const otherSeasonId = await createSeason(other, otherGardenId);
      const photoId = await attachPhoto(other, "https://example.com/p.jpg", {
        seasonId: otherSeasonId,
      });

      const res = await app.request(`/api/v1/photos/${photoId}`, {
        method: "DELETE",
        headers: authHeaders(token),
      });
      expect(res.status).toBe(404);
    });

    it("calls storage.deleteObject for R2-hosted photos", async () => {
      const { deleteObject } = await import("../services/storage.service.js");

      // Simulate an R2-backed photo by inserting directly
      const { db } = await import("../db/index.js");
      const { photos } = await import("../db/schema.js");
      const { eq } = await import("drizzle-orm");

      // First create via upload-url to get storageKey set
      const uploadRes = await app.request("/api/v1/photos/upload-url", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ seasonId }),
      });
      expect(uploadRes.status).toBe(201);
      const uploadData = await uploadRes.json() as Record<string, unknown>;
      const photoId = uploadData.photoId as string;

      // Verify storageKey was saved
      const [row] = await db.select({ storageKey: photos.storageKey }).from(photos).where(eq(photos.id, photoId));
      expect(row.storageKey).toBeTruthy();

      // Now delete
      await app.request(`/api/v1/photos/${photoId}`, {
        method: "DELETE",
        headers: authHeaders(token),
      });

      expect(deleteObject).toHaveBeenCalledWith(row.storageKey);
    });
  });

  // ── Cascade behavior ────────────────────────────────────────────────────

  describe("Cascade behavior", () => {
    it("nullifies seasonId when season is deleted", async () => {
      const photoId = await attachPhoto(
        token,
        "https://example.com/photo.jpg",
        { seasonId },
      );

      // Delete the season via API
      const gardenId = await createGarden(token);
      // We need the gardenId of the season — re-create and check DB directly
      const { db } = await import("../db/index.js");
      const { photos: photosTable } = await import("../db/schema.js");
      const { seasons: seasonsTable } = await import("../db/schema.js");
      const { eq } = await import("drizzle-orm");

      await db.delete(seasonsTable).where(eq(seasonsTable.id, seasonId));

      const [photo] = await db
        .select({ seasonId: photosTable.seasonId })
        .from(photosTable)
        .where(eq(photosTable.id, photoId));

      expect(photo.seasonId).toBeNull();
    });
  });
});


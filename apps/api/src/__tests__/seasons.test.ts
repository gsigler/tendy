import { describe, it, expect, beforeEach } from "vitest";
import { app } from "../app.js";
import {
  cleanDb,
  registerUser,
  authHeaders,
  createGarden,
  createSeason,
} from "./helpers.js";

describe("Seasons routes", () => {
  let token: string;
  let gardenId: string;

  beforeEach(async () => {
    await cleanDb();
    token = await registerUser();
    gardenId = await createGarden(token);
  });

  describe("POST /api/v1/gardens/:gardenId/seasons", () => {
    it("creates a season with year, name, and frost dates", async () => {
      const res = await app.request(`/api/v1/gardens/${gardenId}/seasons`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          year: 2026,
          name: "Spring",
          lastFrostDate: "2026-04-15",
          firstFrostDate: "2026-10-15",
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.id).toBeTypeOf("string");
      expect(body.year).toBe(2026);
      expect(body.name).toBe("Spring");
      expect(body.status).toBe("planning");
    });

    it("returns 404 when garden does not exist", async () => {
      const res = await app.request(
        "/api/v1/gardens/00000000-0000-0000-0000-000000000000/seasons",
        {
          method: "POST",
          headers: authHeaders(token),
          body: JSON.stringify({ year: 2026, name: "Spring" }),
        },
      );

      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/v1/gardens/:gardenId/seasons", () => {
    it("lists seasons for a garden", async () => {
      await createSeason(token, gardenId, { name: "Spring", year: 2026 });
      await createSeason(token, gardenId, { name: "Fall", year: 2026 });

      const res = await app.request(
        `/api/v1/gardens/${gardenId}/seasons`,
        { headers: authHeaders(token) },
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body).toHaveLength(2);
    });
  });

  describe("GET /api/v1/seasons/:seasonId", () => {
    it("returns a season by ID", async () => {
      const seasonId = await createSeason(token, gardenId, { name: "Summer" });

      const res = await app.request(`/api/v1/seasons/${seasonId}`, {
        headers: authHeaders(token),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBe(seasonId);
      expect(body.name).toBe("Summer");
    });

    it("returns error for non-existent season", async () => {
      const res = await app.request(
        "/api/v1/seasons/00000000-0000-0000-0000-000000000000",
        { headers: authHeaders(token) },
      );

      const body = await res.json();
      expect(body.error).toBeDefined();
    });
  });

  describe("GET /api/v1/seasons/:seasonId/summary", () => {
    it("returns a season summary with counts", async () => {
      const seasonId = await createSeason(token, gardenId);

      const res = await app.request(`/api/v1/seasons/${seasonId}/summary`, {
        headers: authHeaders(token),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.season).toBeDefined();
      expect(body.season.id).toBe(seasonId);
      expect(body.spaces).toEqual([]);
      expect(body.plantingCount).toBe(0);
      expect(body.taskCounts).toBeDefined();
    });
  });

  describe("PATCH /api/v1/seasons/:seasonId", () => {
    it("updates season status and frost dates", async () => {
      const seasonId = await createSeason(token, gardenId);

      const res = await app.request(`/api/v1/seasons/${seasonId}`, {
        method: "PATCH",
        headers: authHeaders(token),
        body: JSON.stringify({
          status: "active",
          lastFrostDate: "2026-04-20",
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe("active");
      expect(body.lastFrostDate).toContain("2026-04-20");
    });

    it("returns 404 for non-existent season", async () => {
      const res = await app.request(
        "/api/v1/seasons/00000000-0000-0000-0000-000000000000",
        {
          method: "PATCH",
          headers: authHeaders(token),
          body: JSON.stringify({ status: "active" }),
        },
      );

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/v1/seasons/:seasonId", () => {
    it("deletes a season", async () => {
      const seasonId = await createSeason(token, gardenId);

      const res = await app.request(`/api/v1/seasons/${seasonId}`, {
        method: "DELETE",
        headers: authHeaders(token),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
    });

    it("returns 404 for non-existent season", async () => {
      const res = await app.request(
        "/api/v1/seasons/00000000-0000-0000-0000-000000000000",
        {
          method: "DELETE",
          headers: authHeaders(token),
        },
      );

      expect(res.status).toBe(404);
    });
  });

  describe("Upsert behavior", () => {
    it("returns existing season when creating duplicate year+name", async () => {
      const res1 = await app.request(`/api/v1/gardens/${gardenId}/seasons`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ year: 2026, name: "Spring" }),
      });
      const first = await res1.json();

      const res2 = await app.request(`/api/v1/gardens/${gardenId}/seasons`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ year: 2026, name: "Spring" }),
      });
      const second = await res2.json();

      expect(second.id).toBe(first.id);
      expect(second.alreadyExisted).toBe(true);
    });
  });
});

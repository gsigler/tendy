import { describe, it, expect, beforeEach } from "vitest";
import { app } from "../app.js";
import {
  cleanDb,
  registerUser,
  authHeaders,
  createGarden,
  createSeason,
  createPlanting,
} from "./helpers.js";

describe("Planning routes", () => {
  let token: string;
  let gardenId: string;

  beforeEach(async () => {
    await cleanDb();
    token = await registerUser();
    gardenId = await createGarden(token);
  });

  describe("GET /api/v1/seasons/:seasonId/week-plan", () => {
    it("returns a week plan with overdue, upcoming tasks, and active plantings", async () => {
      const seasonId = await createSeason(token, gardenId);
      await createPlanting(token, seasonId, { crop: "Tomato" });

      const res = await app.request(`/api/v1/seasons/${seasonId}/week-plan`, {
        headers: authHeaders(token),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.overdueTasks).toBeDefined();
      expect(body.upcomingTasks).toBeDefined();
      expect(body.activePlantings).toBeDefined();
      expect(Array.isArray(body.overdueTasks)).toBe(true);
      expect(Array.isArray(body.activePlantings)).toBe(true);
      // Planting is in "planned" stage which is not "finished"/"failed", so should be active
      expect(body.activePlantings).toHaveLength(1);
    });

    it("returns 404 for non-existent season", async () => {
      const res = await app.request(
        "/api/v1/seasons/00000000-0000-0000-0000-000000000000/week-plan",
        { headers: authHeaders(token) },
      );

      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/v1/seasons/:seasonId/planting-schedule", () => {
    it("returns planting schedule when frost dates and catalog data exist", async () => {
      const seasonId = await createSeason(token, gardenId, {
        lastFrostDate: "2026-04-15",
        firstFrostDate: "2026-10-15",
      });

      // Create a catalog entry with timing data
      const catalogRes = await app.request("/api/v1/catalog", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          crop: "Tomato",
          variety: "Roma",
          daysToMaturity: 80,
          startIndoorsWeeks: 8,
          minNightTemp: 50,
        }),
      });
      const catalogEntry = await catalogRes.json();

      // Create a planting that links to catalog (same crop+variety)
      await createPlanting(token, seasonId, {
        crop: "Tomato",
        variety: "Roma",
      });

      const res = await app.request(
        `/api/v1/seasons/${seasonId}/planting-schedule`,
        { headers: authHeaders(token) },
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.lastFrostDate).toBe("2026-04-15");
      expect(body.schedule).toBeDefined();
      expect(Array.isArray(body.schedule)).toBe(true);
      expect(body.schedule).toHaveLength(1);
      expect(body.schedule[0].crop).toBe("Tomato");
      expect(body.schedule[0].dates.transplant).toBeTypeOf("string");
    });

    it("returns error when no last frost date is set", async () => {
      const seasonId = await createSeason(token, gardenId);

      const res = await app.request(
        `/api/v1/seasons/${seasonId}/planting-schedule`,
        { headers: authHeaders(token) },
      );

      // The service returns {error: "No last frost date..."} which the route
      // detects with "error" in result and returns 404
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toContain("last frost date");
    });

    it("returns 404 for non-existent season", async () => {
      const res = await app.request(
        "/api/v1/seasons/00000000-0000-0000-0000-000000000000/planting-schedule",
        { headers: authHeaders(token) },
      );

      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/v1/seasons/:seasonId/generate-tasks", () => {
    it("generates auto tasks from plantings with catalog data", async () => {
      const seasonId = await createSeason(token, gardenId, {
        lastFrostDate: "2026-04-15",
      });

      // Create catalog entry
      await app.request("/api/v1/catalog", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          crop: "Tomato",
          variety: "Brandywine",
          daysToMaturity: 90,
          startIndoorsWeeks: 8,
          minNightTemp: 55,
        }),
      });

      // Create planting linked to catalog
      await createPlanting(token, seasonId, {
        crop: "Tomato",
        variety: "Brandywine",
      });

      const res = await app.request(
        `/api/v1/seasons/${seasonId}/generate-tasks`,
        {
          method: "POST",
          headers: authHeaders(token),
        },
      );

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.created).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(body.tasks)).toBe(true);
      // Should have at least a transplant task
      const taskTypes = body.tasks.map((t: { type: string }) => t.type);
      expect(taskTypes).toContain("transplant");
    });

    it("returns error when no last frost date is set", async () => {
      const seasonId = await createSeason(token, gardenId);

      const res = await app.request(
        `/api/v1/seasons/${seasonId}/generate-tasks`,
        {
          method: "POST",
          headers: authHeaders(token),
        },
      );

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toContain("last frost date");
    });

    it("does not duplicate tasks on second run", async () => {
      const seasonId = await createSeason(token, gardenId, {
        lastFrostDate: "2026-04-15",
      });

      await app.request("/api/v1/catalog", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          crop: "Lettuce",
          variety: "Buttercrunch",
          daysToMaturity: 55,
        }),
      });

      await createPlanting(token, seasonId, {
        crop: "Lettuce",
        variety: "Buttercrunch",
      });

      // First run
      await app.request(`/api/v1/seasons/${seasonId}/generate-tasks`, {
        method: "POST",
        headers: authHeaders(token),
      });

      // Second run
      const res = await app.request(
        `/api/v1/seasons/${seasonId}/generate-tasks`,
        {
          method: "POST",
          headers: authHeaders(token),
        },
      );

      const body = await res.json();
      expect(body.created).toBe(0);
    });
  });
});

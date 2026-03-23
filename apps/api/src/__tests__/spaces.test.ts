import { describe, it, expect, beforeEach } from "vitest";
import { app } from "../app.js";
import {
  cleanDb,
  registerUser,
  authHeaders,
  createGarden,
  createSeason,
  createSpace,
  createPlanting,
} from "./helpers.js";

describe("Spaces routes", () => {
  let token: string;
  let gardenId: string;
  let seasonId: string;

  beforeEach(async () => {
    await cleanDb();
    token = await registerUser();
    gardenId = await createGarden(token);
    seasonId = await createSeason(token, gardenId);
  });

  describe("POST /api/v1/seasons/:seasonId/spaces", () => {
    it("creates a space with type and dimensions", async () => {
      const res = await app.request(`/api/v1/seasons/${seasonId}/spaces`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          name: "Raised Bed 1",
          type: "RaisedBed",
          width: 4,
          length: 8,
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.id).toBeTypeOf("string");
      expect(body.name).toBe("Raised Bed 1");
      expect(body.type).toBe("RaisedBed");
      expect(body.width).toBe(4);
      expect(body.length).toBe(8);
    });

    it("returns 404 when season does not exist", async () => {
      const res = await app.request(
        "/api/v1/seasons/00000000-0000-0000-0000-000000000000/spaces",
        {
          method: "POST",
          headers: authHeaders(token),
          body: JSON.stringify({ name: "Bed", type: "RaisedBed" }),
        },
      );

      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/v1/seasons/:seasonId/spaces", () => {
    it("lists spaces for a season", async () => {
      await createSpace(token, seasonId, { name: "Bed A" });
      await createSpace(token, seasonId, { name: "Bed B" });

      const res = await app.request(`/api/v1/seasons/${seasonId}/spaces`, {
        headers: authHeaders(token),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body).toHaveLength(2);
    });
  });

  describe("GET /api/v1/spaces/:spaceId", () => {
    it("returns a space by ID", async () => {
      const spaceId = await createSpace(token, seasonId, { name: "My Bed" });

      const res = await app.request(`/api/v1/spaces/${spaceId}`, {
        headers: authHeaders(token),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBe(spaceId);
      expect(body.name).toBe("My Bed");
    });

    it("returns error for non-existent space", async () => {
      const res = await app.request(
        "/api/v1/spaces/00000000-0000-0000-0000-000000000000",
        { headers: authHeaders(token) },
      );

      const body = await res.json();
      expect(body.error).toBeDefined();
    });
  });

  describe("PATCH /api/v1/spaces/:spaceId", () => {
    it("updates space fields", async () => {
      const spaceId = await createSpace(token, seasonId);

      const res = await app.request(`/api/v1/spaces/${spaceId}`, {
        method: "PATCH",
        headers: authHeaders(token),
        body: JSON.stringify({ name: "Updated Bed", sunExposure: "full_sun" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.name).toBe("Updated Bed");
      expect(body.sunExposure).toBe("full_sun");
    });

    it("returns 404 for non-existent space", async () => {
      const res = await app.request(
        "/api/v1/spaces/00000000-0000-0000-0000-000000000000",
        {
          method: "PATCH",
          headers: authHeaders(token),
          body: JSON.stringify({ name: "Nope" }),
        },
      );

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/v1/spaces/:spaceId", () => {
    it("deletes a space", async () => {
      const spaceId = await createSpace(token, seasonId);

      const res = await app.request(`/api/v1/spaces/${spaceId}`, {
        method: "DELETE",
        headers: authHeaders(token),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
    });

    it("returns 404 for non-existent space", async () => {
      const res = await app.request(
        "/api/v1/spaces/00000000-0000-0000-0000-000000000000",
        {
          method: "DELETE",
          headers: authHeaders(token),
        },
      );

      expect(res.status).toBe(404);
    });
  });

  describe("Grid operations", () => {
    it("places a planting on the grid, gets it, then removes it", async () => {
      const spaceId = await createSpace(token, seasonId);
      const plantingId = await createPlanting(token, seasonId);

      // Place on grid
      const placeRes = await app.request(`/api/v1/spaces/${spaceId}/grid`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          plantingId,
          cells: [
            { row: 0, col: 0 },
            { row: 0, col: 1 },
          ],
        }),
      });

      expect(placeRes.status).toBe(201);
      const placeBody = await placeRes.json();
      expect(placeBody.placed).toBe(2);

      // Get grid
      const getRes = await app.request(`/api/v1/spaces/${spaceId}/grid`, {
        headers: authHeaders(token),
      });

      expect(getRes.status).toBe(200);
      const gridBody = await getRes.json();
      expect(gridBody.placements).toHaveLength(2);
      expect(gridBody.space.id).toBe(spaceId);

      // Remove from grid
      const removeRes = await app.request(
        `/api/v1/spaces/${spaceId}/grid/${plantingId}`,
        {
          method: "DELETE",
          headers: authHeaders(token),
        },
      );

      expect(removeRes.status).toBe(200);

      // Verify grid is empty
      const afterRes = await app.request(`/api/v1/spaces/${spaceId}/grid`, {
        headers: authHeaders(token),
      });
      const afterBody = await afterRes.json();
      expect(afterBody.placements).toHaveLength(0);
    });
  });

  describe("Ownership isolation", () => {
    it("user B cannot access user A's spaces", async () => {
      const tokenB = await registerUser("userb@test.com", "password123", "User B");
      const spaceId = await createSpace(token, seasonId);

      // user B tries to list spaces under user A's season
      const listRes = await app.request(
        `/api/v1/seasons/${seasonId}/spaces`,
        { headers: authHeaders(tokenB) },
      );
      expect(listRes.status).toBe(404);

      // user B tries to update user A's space
      const updateRes = await app.request(`/api/v1/spaces/${spaceId}`, {
        method: "PATCH",
        headers: authHeaders(tokenB),
        body: JSON.stringify({ name: "Hacked" }),
      });
      expect(updateRes.status).toBe(404);
    });
  });
});

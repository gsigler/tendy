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

describe("Plantings routes", () => {
  let token: string;
  let gardenId: string;
  let seasonId: string;

  beforeEach(async () => {
    await cleanDb();
    token = await registerUser();
    gardenId = await createGarden(token);
    seasonId = await createSeason(token, gardenId);
  });

  describe("POST /api/v1/seasons/:seasonId/plantings", () => {
    it("creates a planting with crop, variety, sourceType", async () => {
      const res = await app.request(
        `/api/v1/seasons/${seasonId}/plantings`,
        {
          method: "POST",
          headers: authHeaders(token),
          body: JSON.stringify({
            crop: "Tomato",
            variety: "Cherokee Purple",
            sourceType: "seed",
          }),
        },
      );

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.id).toBeTypeOf("string");
      expect(body.crop).toBe("Tomato");
      expect(body.variety).toBe("Cherokee Purple");
      expect(body.sourceType).toBe("seed");
      expect(body.stage).toBe("planned");
    });

    it("returns 404 when season does not exist", async () => {
      const res = await app.request(
        "/api/v1/seasons/00000000-0000-0000-0000-000000000000/plantings",
        {
          method: "POST",
          headers: authHeaders(token),
          body: JSON.stringify({ crop: "Tomato" }),
        },
      );

      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/v1/seasons/:seasonId/plantings", () => {
    it("lists plantings for a season", async () => {
      await createPlanting(token, seasonId, { crop: "Tomato" });
      await createPlanting(token, seasonId, { crop: "Pepper" });

      const res = await app.request(
        `/api/v1/seasons/${seasonId}/plantings`,
        { headers: authHeaders(token) },
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body).toHaveLength(2);
    });

    it("filters plantings by stage", async () => {
      const plantingId = await createPlanting(token, seasonId, { crop: "Tomato" });

      // Advance one to seeded_indoors
      await app.request(`/api/v1/plantings/${plantingId}/advance-stage`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ stage: "seeded_indoors" }),
      });

      await createPlanting(token, seasonId, { crop: "Pepper" }); // stays planned

      const res = await app.request(
        `/api/v1/seasons/${seasonId}/plantings?stage=planned`,
        { headers: authHeaders(token) },
      );

      const body = await res.json();
      expect(body).toHaveLength(1);
      expect(body[0].crop).toBe("Pepper");
    });
  });

  describe("GET /api/v1/plantings/:plantingId", () => {
    it("returns a planting by ID", async () => {
      const plantingId = await createPlanting(token, seasonId);

      const res = await app.request(`/api/v1/plantings/${plantingId}`, {
        headers: authHeaders(token),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBe(plantingId);
      expect(body.crop).toBe("Tomato");
    });

    it("returns error for non-existent planting", async () => {
      const res = await app.request(
        "/api/v1/plantings/00000000-0000-0000-0000-000000000000",
        { headers: authHeaders(token) },
      );

      const body = await res.json();
      expect(body.error).toBeDefined();
    });
  });

  describe("PATCH /api/v1/plantings/:plantingId", () => {
    it("updates planting fields", async () => {
      const plantingId = await createPlanting(token, seasonId);

      const res = await app.request(`/api/v1/plantings/${plantingId}`, {
        method: "PATCH",
        headers: authHeaders(token),
        body: JSON.stringify({ variety: "Brandywine", notes: "Large fruit" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.variety).toBe("Brandywine");
      expect(body.notes).toBe("Large fruit");
    });

    it("returns 404 for non-existent planting", async () => {
      const res = await app.request(
        "/api/v1/plantings/00000000-0000-0000-0000-000000000000",
        {
          method: "PATCH",
          headers: authHeaders(token),
          body: JSON.stringify({ notes: "Nope" }),
        },
      );

      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/v1/plantings/:plantingId/advance-stage", () => {
    it("advances from planned to seeded_indoors", async () => {
      const plantingId = await createPlanting(token, seasonId);

      const res = await app.request(
        `/api/v1/plantings/${plantingId}/advance-stage`,
        {
          method: "POST",
          headers: authHeaders(token),
          body: JSON.stringify({ stage: "seeded_indoors" }),
        },
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.stage).toBe("seeded_indoors");
      expect(body.startedAt).toBeTypeOf("string");
    });

    it("advances through multiple stages", async () => {
      const plantingId = await createPlanting(token, seasonId);
      const stages = ["seeded_indoors", "seedling", "hardening_off", "transplanted", "producing", "finished"];

      for (const stage of stages) {
        const res = await app.request(
          `/api/v1/plantings/${plantingId}/advance-stage`,
          {
            method: "POST",
            headers: authHeaders(token),
            body: JSON.stringify({ stage }),
          },
        );
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.stage).toBe(stage);
      }
    });
  });

  describe("POST /api/v1/plantings/:plantingId/health", () => {
    it("updates health with reason", async () => {
      const plantingId = await createPlanting(token, seasonId);

      const res = await app.request(
        `/api/v1/plantings/${plantingId}/health`,
        {
          method: "POST",
          headers: authHeaders(token),
          body: JSON.stringify({ health: "poor", reason: "Too much sun" }),
        },
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.health).toBe("poor");
    });
  });

  describe("POST /api/v1/plantings/:plantingId/move", () => {
    it("moves planting to a different space", async () => {
      const spaceA = await createSpace(token, seasonId, { name: "Bed A" });
      const spaceB = await createSpace(token, seasonId, { name: "Bed B" });
      const plantingId = await createPlanting(token, seasonId, {
        spaceId: spaceA,
      });

      const res = await app.request(
        `/api/v1/plantings/${plantingId}/move`,
        {
          method: "POST",
          headers: authHeaders(token),
          body: JSON.stringify({ spaceId: spaceB }),
        },
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.newSpaceId).toBe(spaceB);
    });

    it("returns 404 for non-existent destination space", async () => {
      const plantingId = await createPlanting(token, seasonId);

      const res = await app.request(
        `/api/v1/plantings/${plantingId}/move`,
        {
          method: "POST",
          headers: authHeaders(token),
          body: JSON.stringify({
            spaceId: "00000000-0000-0000-0000-000000000000",
          }),
        },
      );

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/v1/plantings/:plantingId", () => {
    it("deletes a planting", async () => {
      const plantingId = await createPlanting(token, seasonId);

      const res = await app.request(`/api/v1/plantings/${plantingId}`, {
        method: "DELETE",
        headers: authHeaders(token),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
    });

    it("returns 404 for non-existent planting", async () => {
      const res = await app.request(
        "/api/v1/plantings/00000000-0000-0000-0000-000000000000",
        {
          method: "DELETE",
          headers: authHeaders(token),
        },
      );

      expect(res.status).toBe(404);
    });
  });

  describe("Ownership isolation", () => {
    it("user B cannot list or modify user A's plantings", async () => {
      const tokenB = await registerUser("userb@test.com", "password123", "User B");
      const plantingId = await createPlanting(token, seasonId);

      // List under user A's season
      const listRes = await app.request(
        `/api/v1/seasons/${seasonId}/plantings`,
        { headers: authHeaders(tokenB) },
      );
      expect(listRes.status).toBe(404);

      // Update user A's planting
      const updateRes = await app.request(`/api/v1/plantings/${plantingId}`, {
        method: "PATCH",
        headers: authHeaders(tokenB),
        body: JSON.stringify({ notes: "Hacked" }),
      });
      expect(updateRes.status).toBe(404);

      // Delete user A's planting
      const deleteRes = await app.request(`/api/v1/plantings/${plantingId}`, {
        method: "DELETE",
        headers: authHeaders(tokenB),
      });
      expect(deleteRes.status).toBe(404);
    });
  });
});

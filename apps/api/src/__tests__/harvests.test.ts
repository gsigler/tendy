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

describe("Harvests", () => {
  let token: string;
  let seasonId: string;
  let plantingId: string;
  let spaceId: string;

  beforeEach(async () => {
    await cleanDb();
    token = await registerUser();
    const gardenId = await createGarden(token);
    seasonId = await createSeason(token, gardenId);
    spaceId = await createSpace(token, seasonId);
    plantingId = await createPlanting(token, seasonId);
  });

  describe("POST /api/v1/seasons/:seasonId/harvests", () => {
    it("records a harvest with crop and quantity", async () => {
      const res = await app.request(`/api/v1/seasons/${seasonId}/harvests`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          crop: "Tomato",
          variety: "Cherokee Purple",
          quantity: 5,
          quantityUnit: "fruits",
          weightOz: 24,
          quality: "excellent",
          notes: "First harvest of the season!",
        }),
      });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.crop).toBe("Tomato");
      expect(data.variety).toBe("Cherokee Purple");
      expect(data.quantity).toBe(5);
      expect(data.quantityUnit).toBe("fruits");
      expect(data.weightOz).toBe(24);
      expect(data.quality).toBe("excellent");
      expect(data.id).toBeDefined();
    });

    it("links harvest to a planting and auto-fills crop/variety", async () => {
      const res = await app.request(`/api/v1/seasons/${seasonId}/harvests`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          crop: "Tomato",
          plantingId,
          quantity: 3,
          quantityUnit: "fruits",
        }),
      });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.plantingId).toBe(plantingId);
      expect(data.crop).toBe("Tomato");
    });

    it("links harvest to a space", async () => {
      const res = await app.request(`/api/v1/seasons/${seasonId}/harvests`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          crop: "Lettuce",
          spaceId,
          quantity: 1,
          quantityUnit: "heads",
        }),
      });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.spaceId).toBe(spaceId);
    });
  });

  describe("GET /api/v1/seasons/:seasonId/harvests", () => {
    it("lists harvests for a season", async () => {
      // Create two harvests
      await app.request(`/api/v1/seasons/${seasonId}/harvests`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ crop: "Tomato", quantity: 5, quantityUnit: "fruits" }),
      });
      await app.request(`/api/v1/seasons/${seasonId}/harvests`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ crop: "Basil", quantity: 2, quantityUnit: "bunches" }),
      });

      const res = await app.request(`/api/v1/seasons/${seasonId}/harvests`, {
        headers: authHeaders(token),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveLength(2);
    });

    it("returns empty array for season with no harvests", async () => {
      const res = await app.request(`/api/v1/seasons/${seasonId}/harvests`, {
        headers: authHeaders(token),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveLength(0);
    });
  });

  describe("GET /api/v1/harvests/:harvestId", () => {
    it("gets a single harvest by ID", async () => {
      const createRes = await app.request(`/api/v1/seasons/${seasonId}/harvests`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ crop: "Pepper", quantity: 8, quantityUnit: "fruits" }),
      });
      const { id } = (await createRes.json()) as { id: string };

      const res = await app.request(`/api/v1/harvests/${id}`, {
        headers: authHeaders(token),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.id).toBe(id);
      expect(data.crop).toBe("Pepper");
    });
  });

  describe("PATCH /api/v1/harvests/:harvestId", () => {
    it("updates harvest fields", async () => {
      const createRes = await app.request(`/api/v1/seasons/${seasonId}/harvests`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ crop: "Tomato", quantity: 3, quantityUnit: "fruits" }),
      });
      const { id } = (await createRes.json()) as { id: string };

      const res = await app.request(`/api/v1/harvests/${id}`, {
        method: "PATCH",
        headers: authHeaders(token),
        body: JSON.stringify({ quantity: 5, weightOz: 16, quality: "good" }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.quantity).toBe(5);
      expect(data.weightOz).toBe(16);
      expect(data.quality).toBe("good");
    });
  });

  describe("DELETE /api/v1/harvests/:harvestId", () => {
    it("deletes a harvest", async () => {
      const createRes = await app.request(`/api/v1/seasons/${seasonId}/harvests`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ crop: "Tomato", quantity: 1, quantityUnit: "fruits" }),
      });
      const { id } = (await createRes.json()) as { id: string };

      const delRes = await app.request(`/api/v1/harvests/${id}`, {
        method: "DELETE",
        headers: authHeaders(token),
      });
      expect(delRes.status).toBe(200);

      // Verify it's gone
      const listRes = await app.request(`/api/v1/seasons/${seasonId}/harvests`, {
        headers: authHeaders(token),
      });
      const data = await listRes.json();
      expect(data).toHaveLength(0);
    });
  });

  describe("GET /api/v1/seasons/:seasonId/harvest-summary", () => {
    it("returns harvest totals grouped by crop", async () => {
      // Record multiple harvests
      await app.request(`/api/v1/seasons/${seasonId}/harvests`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ crop: "Tomato", variety: "Cherokee Purple", quantity: 5, weightOz: 20 }),
      });
      await app.request(`/api/v1/seasons/${seasonId}/harvests`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ crop: "Tomato", variety: "Cherokee Purple", quantity: 8, weightOz: 32 }),
      });
      await app.request(`/api/v1/seasons/${seasonId}/harvests`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ crop: "Basil", quantity: 2, weightOz: 4 }),
      });

      const res = await app.request(`/api/v1/seasons/${seasonId}/harvest-summary`, {
        headers: authHeaders(token),
      });
      expect(res.status).toBe(200);
      const data = (await res.json()) as Array<{ crop: string; harvestCount: number; totalQuantity: number; totalWeightOz: number }>;
      expect(data).toHaveLength(2);

      const tomato = data.find((r) => r.crop === "Tomato");
      expect(tomato).toBeDefined();
      expect(Number(tomato!.harvestCount)).toBe(2);
      expect(Number(tomato!.totalQuantity)).toBe(13);
      expect(Number(tomato!.totalWeightOz)).toBe(52);
    });
  });

  describe("ownership isolation", () => {
    it("user B cannot list user A's harvests", async () => {
      // Create a harvest as user A
      await app.request(`/api/v1/seasons/${seasonId}/harvests`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ crop: "Tomato", quantity: 5, quantityUnit: "fruits" }),
      });

      // Register user B
      const tokenB = await registerUser("userb@test.com");

      const res = await app.request(`/api/v1/seasons/${seasonId}/harvests`, {
        headers: authHeaders(tokenB),
      });
      // Should fail — user B doesn't own this season
      expect(res.status).toBe(404);
    });
  });
});

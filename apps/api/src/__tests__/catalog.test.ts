import { describe, it, expect, beforeEach } from "vitest";
import { app } from "../app.js";
import {
  cleanDb,
  registerUser,
  authHeaders,
} from "./helpers.js";

describe("Catalog routes", () => {
  let token: string;

  beforeEach(async () => {
    await cleanDb();
    token = await registerUser();
  });

  async function createCatalogEntry(overrides: Record<string, unknown> = {}) {
    const res = await app.request("/api/v1/catalog", {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({
        crop: "Tomato",
        variety: "Cherokee Purple",
        daysToMaturity: 80,
        startIndoorsWeeks: 8,
        ...overrides,
      }),
    });
    return (await res.json()) as { id: string; crop: string };
  }

  describe("POST /api/v1/catalog", () => {
    it("creates a catalog entry", async () => {
      const res = await app.request("/api/v1/catalog", {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          crop: "Pepper",
          variety: "Jalapeno",
          daysToMaturity: 70,
          vendor: "Seeds Co",
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.id).toBeTypeOf("string");
      expect(body.crop).toBe("Pepper");
      expect(body.variety).toBe("Jalapeno");
      expect(body.daysToMaturity).toBe(70);
    });
  });

  describe("GET /api/v1/catalog (search)", () => {
    it("searches catalog by crop name", async () => {
      await createCatalogEntry({ crop: "Tomato", variety: "Roma" });
      await createCatalogEntry({ crop: "Tomato", variety: "Brandywine" });
      await createCatalogEntry({ crop: "Pepper", variety: "Habanero" });

      const res = await app.request("/api/v1/catalog?q=Tomato", {
        headers: authHeaders(token),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveLength(2);
      for (const entry of body) {
        expect(entry.crop).toBe("Tomato");
      }
    });

    it("returns all entries when query is empty", async () => {
      await createCatalogEntry({ crop: "Tomato", variety: "Cherry" });
      await createCatalogEntry({ crop: "Pepper", variety: "Bell" });

      const res = await app.request("/api/v1/catalog", {
        headers: authHeaders(token),
      });

      const body = await res.json();
      expect(body).toHaveLength(2);
    });
  });

  describe("GET /api/v1/catalog/:catalogId", () => {
    it("returns a catalog entry by ID", async () => {
      const entry = await createCatalogEntry();

      const res = await app.request(`/api/v1/catalog/${entry.id}`, {
        headers: authHeaders(token),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBe(entry.id);
      expect(body.crop).toBe("Tomato");
      expect(body.daysToMaturity).toBe(80);
    });

    it("returns 404 for non-existent entry", async () => {
      const res = await app.request(
        "/api/v1/catalog/00000000-0000-0000-0000-000000000000",
        { headers: authHeaders(token) },
      );

      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /api/v1/catalog/:catalogId", () => {
    it("updates catalog entry fields", async () => {
      const entry = await createCatalogEntry();

      const res = await app.request(`/api/v1/catalog/${entry.id}`, {
        method: "PATCH",
        headers: authHeaders(token),
        body: JSON.stringify({ daysToMaturity: 90, vendor: "New Vendor" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.daysToMaturity).toBe(90);
    });

    it("returns 404 for non-existent entry", async () => {
      const res = await app.request(
        "/api/v1/catalog/00000000-0000-0000-0000-000000000000",
        {
          method: "PATCH",
          headers: authHeaders(token),
          body: JSON.stringify({ vendor: "Nope" }),
        },
      );

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/v1/catalog/:catalogId", () => {
    it("deletes a catalog entry", async () => {
      const entry = await createCatalogEntry();

      const res = await app.request(`/api/v1/catalog/${entry.id}`, {
        method: "DELETE",
        headers: authHeaders(token),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
    });
  });

  describe("Catalog rating and review fields", () => {
    it("updates rating and wouldGrowAgain on catalog entry", async () => {
      const entry = await createCatalogEntry();

      const res = await app.request(`/api/v1/catalog/${entry.id}`, {
        method: "PATCH",
        headers: authHeaders(token),
        body: JSON.stringify({
          rating: 5,
          wouldGrowAgain: 1,
          yieldNotes: "Prolific producer, 20+ fruits per plant",
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.daysToMaturity).toBe(80); // unchanged

      // Verify the fields were saved by fetching the entry
      const getRes = await app.request(`/api/v1/catalog/${entry.id}`, {
        headers: authHeaders(token),
      });
      const full = (await getRes.json()) as Record<string, unknown>;
      expect(full.rating).toBe(5);
      expect(full.wouldGrowAgain).toBe(1);
      expect(full.yieldNotes).toBe("Prolific producer, 20+ fruits per plant");
    });
  });
});

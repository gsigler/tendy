import { describe, it, expect, beforeEach } from "vitest";
import { app } from "../app.js";
import {
  cleanDb,
  registerUser,
  authHeaders,
  createGarden,
  createSeason,
} from "./helpers.js";

describe("Events routes", () => {
  let token: string;
  let seasonId: string;

  beforeEach(async () => {
    await cleanDb();
    token = await registerUser();
    const gardenId = await createGarden(token);
    seasonId = await createSeason(token, gardenId);
  });

  describe("POST /api/v1/seasons/:seasonId/events", () => {
    it("records an event with type and summary", async () => {
      const res = await app.request(`/api/v1/seasons/${seasonId}/events`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          type: "observation",
          summary: "First seedlings emerging",
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.id).toBeTypeOf("string");
      expect(body.type).toBe("observation");
      expect(body.summary).toBe("First seedlings emerging");
      expect(body.happenedAt).toBeTypeOf("string");
    });

    it("returns 404 when season does not exist", async () => {
      const res = await app.request(
        "/api/v1/seasons/00000000-0000-0000-0000-000000000000/events",
        {
          method: "POST",
          headers: authHeaders(token),
          body: JSON.stringify({ type: "observation", summary: "test" }),
        },
      );

      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/v1/seasons/:seasonId/events", () => {
    it("lists recent events", async () => {
      await app.request(`/api/v1/seasons/${seasonId}/events`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ type: "observation", summary: "Event 1" }),
      });
      await app.request(`/api/v1/seasons/${seasonId}/events`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ type: "weather", summary: "Event 2" }),
      });

      const res = await app.request(`/api/v1/seasons/${seasonId}/events`, {
        headers: authHeaders(token),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body).toHaveLength(2);
    });

    it("respects limit parameter", async () => {
      for (let i = 0; i < 5; i++) {
        await app.request(`/api/v1/seasons/${seasonId}/events`, {
          method: "POST",
          headers: authHeaders(token),
          body: JSON.stringify({ type: "observation", summary: `Event ${i}` }),
        });
      }

      const res = await app.request(
        `/api/v1/seasons/${seasonId}/events?limit=2`,
        { headers: authHeaders(token) },
      );

      const body = await res.json();
      expect(body).toHaveLength(2);
    });

    it("returns 404 for non-existent season", async () => {
      const res = await app.request(
        "/api/v1/seasons/00000000-0000-0000-0000-000000000000/events",
        { headers: authHeaders(token) },
      );

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/v1/events/:eventId", () => {
    it("deletes an event", async () => {
      const createRes = await app.request(
        `/api/v1/seasons/${seasonId}/events`,
        {
          method: "POST",
          headers: authHeaders(token),
          body: JSON.stringify({ type: "observation", summary: "Delete me" }),
        },
      );
      const { id } = (await createRes.json()) as { id: string };

      const res = await app.request(`/api/v1/events/${id}`, {
        method: "DELETE",
        headers: authHeaders(token),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
    });

    it("returns 404 for non-existent event", async () => {
      const res = await app.request(
        "/api/v1/events/00000000-0000-0000-0000-000000000000",
        {
          method: "DELETE",
          headers: authHeaders(token),
        },
      );

      expect(res.status).toBe(404);
    });
  });
});

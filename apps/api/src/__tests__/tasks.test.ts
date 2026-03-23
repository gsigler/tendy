import { describe, it, expect, beforeEach } from "vitest";
import { app } from "../app.js";
import {
  cleanDb,
  registerUser,
  authHeaders,
  createGarden,
  createSeason,
} from "./helpers.js";

describe("Tasks routes", () => {
  let token: string;
  let seasonId: string;

  beforeEach(async () => {
    await cleanDb();
    token = await registerUser();
    const gardenId = await createGarden(token);
    seasonId = await createSeason(token, gardenId);
  });

  async function createTask(overrides: Record<string, unknown> = {}) {
    const res = await app.request(`/api/v1/seasons/${seasonId}/tasks`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({
        title: "Water tomatoes",
        type: "watering",
        priority: "medium",
        dueAt: "2026-04-15T10:00:00Z",
        ...overrides,
      }),
    });
    const body = (await res.json()) as { id: string };
    return body.id;
  }

  describe("POST /api/v1/seasons/:seasonId/tasks", () => {
    it("creates a task with title, type, priority, dueAt", async () => {
      const res = await app.request(`/api/v1/seasons/${seasonId}/tasks`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          title: "Plant lettuce",
          type: "seed_start",
          priority: "high",
          dueAt: "2026-03-20T08:00:00Z",
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.id).toBeTypeOf("string");
      expect(body.title).toBe("Plant lettuce");
      expect(body.type).toBe("seed_start");
      expect(body.priority).toBe("high");
      expect(body.dueAt).toContain("2026-03-20");
    });

    it("returns 404 when season does not exist", async () => {
      const res = await app.request(
        "/api/v1/seasons/00000000-0000-0000-0000-000000000000/tasks",
        {
          method: "POST",
          headers: authHeaders(token),
          body: JSON.stringify({ title: "Nope" }),
        },
      );

      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/v1/seasons/:seasonId/tasks", () => {
    it("lists tasks for a season", async () => {
      await createTask({ title: "Task 1" });
      await createTask({ title: "Task 2" });

      const res = await app.request(`/api/v1/seasons/${seasonId}/tasks`, {
        headers: authHeaders(token),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveLength(2);
    });

    it("filters tasks by status", async () => {
      const taskId = await createTask({ title: "Done Task" });

      // Complete it
      await app.request(`/api/v1/tasks/${taskId}/complete`, {
        method: "POST",
        headers: authHeaders(token),
      });

      await createTask({ title: "Pending Task" });

      const res = await app.request(
        `/api/v1/seasons/${seasonId}/tasks?status=pending`,
        { headers: authHeaders(token) },
      );

      const body = await res.json();
      expect(body).toHaveLength(1);
      expect(body[0].title).toBe("Pending Task");
    });
  });

  describe("GET /api/v1/tasks/:taskId", () => {
    it("returns a task by ID", async () => {
      const taskId = await createTask({ title: "Get this task" });

      const res = await app.request(`/api/v1/tasks/${taskId}`, {
        headers: authHeaders(token),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBe(taskId);
      expect(body.title).toBe("Get this task");
    });

    it("returns error for non-existent task", async () => {
      const res = await app.request(
        "/api/v1/tasks/00000000-0000-0000-0000-000000000000",
        { headers: authHeaders(token) },
      );

      const body = await res.json();
      expect(body.error).toBeDefined();
    });
  });

  describe("PATCH /api/v1/tasks/:taskId", () => {
    it("updates task fields", async () => {
      const taskId = await createTask();

      const res = await app.request(`/api/v1/tasks/${taskId}`, {
        method: "PATCH",
        headers: authHeaders(token),
        body: JSON.stringify({ title: "Updated title", priority: "high" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.title).toBe("Updated title");
      expect(body.priority).toBe("high");
    });
  });

  describe("POST /api/v1/tasks/:taskId/complete", () => {
    it("completes a task", async () => {
      const taskId = await createTask();

      const res = await app.request(`/api/v1/tasks/${taskId}/complete`, {
        method: "POST",
        headers: authHeaders(token),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe("completed");
    });

    it("returns 404 for non-existent task", async () => {
      const res = await app.request(
        "/api/v1/tasks/00000000-0000-0000-0000-000000000000/complete",
        {
          method: "POST",
          headers: authHeaders(token),
        },
      );

      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/v1/tasks/:taskId/skip", () => {
    it("skips a task", async () => {
      const taskId = await createTask();

      const res = await app.request(`/api/v1/tasks/${taskId}/skip`, {
        method: "POST",
        headers: authHeaders(token),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe("skipped");
    });
  });

  describe("DELETE /api/v1/tasks/:taskId", () => {
    it("deletes a task", async () => {
      const taskId = await createTask();

      const res = await app.request(`/api/v1/tasks/${taskId}`, {
        method: "DELETE",
        headers: authHeaders(token),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
    });

    it("returns 404 for non-existent task", async () => {
      const res = await app.request(
        "/api/v1/tasks/00000000-0000-0000-0000-000000000000",
        {
          method: "DELETE",
          headers: authHeaders(token),
        },
      );

      expect(res.status).toBe(404);
    });
  });
});

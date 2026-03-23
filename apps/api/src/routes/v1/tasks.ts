import { Hono } from "hono";
import { z } from "zod";
import type { AuthEnv } from "../../middleware/auth.js";
import { taskService } from "../../services/index.js";
import { TaskType, TaskPriority } from "@tendy/shared";

export const tasks = new Hono<AuthEnv>();

const CreateTaskSchema = z.object({
  title: z.string().min(1),
  type: TaskType.optional(),
  priority: TaskPriority.optional(),
  dueAt: z.string().optional(),
  plantingId: z.string().uuid().optional(),
  spaceId: z.string().uuid().optional(),
  notes: z.string().optional(),
});

const UpdateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  priority: TaskPriority.optional(),
  dueAt: z.string().optional(),
  notes: z.string().optional(),
});

// Nested under /seasons/:seasonId/tasks
tasks.get("/seasons/:seasonId/tasks", async (c) => {
  const userId = c.get("userId");
  const seasonId = c.req.param("seasonId");
  const status = c.req.query("status");
  const result = await taskService.list(userId, seasonId, status);
  if ("error" in result) return c.json(result, 404);
  return c.json(result);
});

tasks.post("/seasons/:seasonId/tasks", async (c) => {
  const userId = c.get("userId");
  const seasonId = c.req.param("seasonId");
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  const parsed = CreateTaskSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" }, 400);
  }
  const result = await taskService.create(userId, { ...parsed.data, seasonId });
  if ("error" in result) return c.json(result, 404);
  return c.json(result, 201);
});

// Direct /tasks/:taskId routes
tasks.get("/tasks/:taskId", async (c) => {
  const userId = c.get("userId");
  const taskId = c.req.param("taskId");
  const result = await taskService.get(userId, taskId);
  if ("error" in result) return c.json(result, 404);
  return c.json(result);
});

tasks.patch("/tasks/:taskId", async (c) => {
  const userId = c.get("userId");
  const taskId = c.req.param("taskId");
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  const parsed = UpdateTaskSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" }, 400);
  }
  const result = await taskService.update(userId, taskId, parsed.data);
  if ("error" in result) return c.json(result, 404);
  return c.json(result);
});

tasks.post("/tasks/:taskId/complete", async (c) => {
  const userId = c.get("userId");
  const taskId = c.req.param("taskId");
  const result = await taskService.complete(userId, taskId);
  if ("error" in result) return c.json(result, 404);
  return c.json(result);
});

tasks.post("/tasks/:taskId/skip", async (c) => {
  const userId = c.get("userId");
  const taskId = c.req.param("taskId");
  const result = await taskService.skip(userId, taskId);
  if ("error" in result) return c.json(result, 404);
  return c.json(result);
});

tasks.delete("/tasks/:taskId", async (c) => {
  const userId = c.get("userId");
  const taskId = c.req.param("taskId");
  const result = await taskService.del(userId, taskId);
  if ("error" in result) return c.json(result, 404);
  return c.json({ ok: true });
});

import { Hono } from "hono";
import type { AuthEnv } from "../../middleware/auth.js";
import { planningService } from "../../services/index.js";

export const planning = new Hono<AuthEnv>();

planning.get("/seasons/:seasonId/week-plan", async (c) => {
  const userId = c.get("userId");
  const seasonId = c.req.param("seasonId");
  const result = await planningService.getWeekPlan(userId, seasonId);
  if ("error" in result) return c.json(result, 404);
  return c.json(result);
});

planning.get("/seasons/:seasonId/planting-schedule", async (c) => {
  const userId = c.get("userId");
  const seasonId = c.req.param("seasonId");
  const result = await planningService.getPlantingSchedule(userId, seasonId);
  if ("error" in result) return c.json(result, 404);
  return c.json(result);
});

planning.post("/seasons/:seasonId/generate-tasks", async (c) => {
  const userId = c.get("userId");
  const seasonId = c.req.param("seasonId");
  const result = await planningService.generateAutoTasks(userId, seasonId);
  if ("error" in result) return c.json(result, 404);
  return c.json(result, 201);
});

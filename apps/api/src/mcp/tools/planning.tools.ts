import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as planningService from "../../services/planning.service.js";

export function registerPlanningTools(server: McpServer, userId: string) {
  server.tool(
    "getWeekPlan",
    "Get the week plan for a season: overdue tasks, tasks due in the next 7 days, and all active plantings (not finished or failed).",
    {
      seasonId: z.string().describe("ID of the season"),
    },
    async ({ seasonId }) => {
      try {
        const plan = await planningService.getWeekPlan(userId, seasonId);
        return { content: [{ type: "text", text: JSON.stringify(plan, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text", text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  server.tool(
    "getPlantingSchedule",
    "Get computed planting schedule for a season based on last frost date and catalog data. Shows recommended start-indoors, harden-off, transplant, and harvest dates for each planting. Requires the season to have a last frost date set.",
    {
      seasonId: z.string().describe("ID of the season"),
    },
    async ({ seasonId }) => {
      try {
        const schedule = await planningService.getPlantingSchedule(userId, seasonId);
        return { content: [{ type: "text", text: JSON.stringify(schedule, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text", text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  server.tool(
    "generateAutoTasks",
    "Auto-generate tasks for a season based on planting catalog data and frost dates. Creates seed start and transplant tasks that don't already exist. Requires the season to have a last frost date set.",
    {
      seasonId: z.string().describe("ID of the season"),
    },
    async ({ seasonId }) => {
      try {
        const result = await planningService.generateAutoTasks(userId, seasonId);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text", text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );
}

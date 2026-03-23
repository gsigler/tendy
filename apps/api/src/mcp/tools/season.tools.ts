import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as seasonService from "../../services/season.service.js";

export function registerSeasonTools(server: McpServer, userId: string) {
  server.tool(
    "listSeasons",
    "List all seasons for a garden, ordered by year descending. Returns id, year, name, status, and frost dates.",
    {
      gardenId: z.string().describe("ID of the garden"),
    },
    async ({ gardenId }) => {
      try {
        const seasons = await seasonService.list(userId, gardenId);
        return { content: [{ type: "text", text: JSON.stringify(seasons, null, 2) }] };
      } catch (e) {
        console.error("[mcp] tool error:", e);
        return { content: [{ type: "text", text: "An error occurred. Please try again." }], isError: true };
      }
    },
  );

  server.tool(
    "getSeason",
    "Get details of a specific season by ID",
    {
      seasonId: z.string().describe("Season ID"),
    },
    async ({ seasonId }) => {
      try {
        const season = await seasonService.get(userId, seasonId);
        if (!season) return { content: [{ type: "text" as const, text: "Season not found" }], isError: true };
        return { content: [{ type: "text" as const, text: JSON.stringify(season, null, 2) }] };
      } catch (e) {
        console.error("[mcp] tool error:", e);
        return { content: [{ type: "text" as const, text: "An error occurred. Please try again." }], isError: true };
      }
    },
  );

  server.tool(
    "createSeason",
    "Create a new season in a garden. Uses upsert: if a season with the same garden+year+name exists, it returns the existing one (updating frost dates if provided).",
    {
      gardenId: z.string().describe("ID of the garden"),
      year: z.number().describe("Year for the season (e.g. 2026)"),
      name: z.string().describe("Season name (e.g. 'Spring', 'Fall')"),
      lastFrostDate: z.string().optional().describe("Last expected spring frost date (ISO string, e.g. '2026-04-15')"),
      firstFrostDate: z.string().optional().describe("First expected fall frost date (ISO string, e.g. '2026-10-15')"),
    },
    async (params) => {
      try {
        const season = await seasonService.create(userId, params);
        return { content: [{ type: "text", text: JSON.stringify(season, null, 2) }] };
      } catch (e) {
        console.error("[mcp] tool error:", e);
        return { content: [{ type: "text", text: "An error occurred. Please try again." }], isError: true };
      }
    },
  );

  server.tool(
    "updateSeason",
    "Update a season's frost dates or status. Only provided fields are changed.",
    {
      seasonId: z.string().describe("ID of the season to update"),
      lastFrostDate: z.string().optional().describe("New last frost date (ISO string)"),
      firstFrostDate: z.string().optional().describe("New first frost date (ISO string)"),
      status: z.enum(["planning", "active", "complete"]).optional().describe("New season status"),
    },
    async ({ seasonId, ...params }) => {
      try {
        const result = await seasonService.update(userId, seasonId, params);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        console.error("[mcp] tool error:", e);
        return { content: [{ type: "text", text: "An error occurred. Please try again." }], isError: true };
      }
    },
  );

  server.tool(
    "deleteSeason",
    "Delete a season and ALL its data (spaces, plantings, tasks, events, grid placements). Cascade delete, cannot be undone.",
    {
      seasonId: z.string().describe("ID of the season to delete"),
    },
    async ({ seasonId }) => {
      try {
        const result = await seasonService.del(userId, seasonId);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        console.error("[mcp] tool error:", e);
        return { content: [{ type: "text", text: "An error occurred. Please try again." }], isError: true };
      }
    },
  );

  server.tool(
    "getSeasonSummary",
    "Get a high-level summary of a season: season details, list of spaces, planting counts by stage, and task counts (pending/completed/overdue).",
    {
      seasonId: z.string().describe("ID of the season"),
    },
    async ({ seasonId }) => {
      try {
        const summary = await seasonService.getSummary(userId, seasonId);
        return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] };
      } catch (e) {
        console.error("[mcp] tool error:", e);
        return { content: [{ type: "text", text: "An error occurred. Please try again." }], isError: true };
      }
    },
  );
}

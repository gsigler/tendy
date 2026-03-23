import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as harvestService from "../../services/harvest.service.js";

export function registerHarvestTools(server: McpServer, userId: string) {
  server.tool(
    "listHarvests",
    "List all harvests for a season, ordered by most recent first",
    { seasonId: z.string().describe("Season ID") },
    async ({ seasonId }) => {
      try {
        const result = await harvestService.list(userId, seasonId);
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        console.error("[mcp] tool error:", e);
        return { content: [{ type: "text" as const, text: "An error occurred. Please try again." }], isError: true };
      }
    },
  );

  server.tool(
    "getHarvest",
    "Get details of a single harvest by ID",
    { harvestId: z.string().describe("Harvest ID") },
    async ({ harvestId }) => {
      try {
        const result = await harvestService.get(userId, harvestId);
        if (!result) return { content: [{ type: "text" as const, text: "Harvest not found" }], isError: true };
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        console.error("[mcp] tool error:", e);
        return { content: [{ type: "text" as const, text: "An error occurred. Please try again." }], isError: true };
      }
    },
  );

  server.tool(
    "recordHarvest",
    "Record a harvest. Links to a season and optionally to a planting and space. If plantingId is provided, crop/variety are auto-filled from the planting.",
    {
      seasonId: z.string().describe("Season ID"),
      crop: z.string().describe("Crop name (e.g. 'Tomato')"),
      variety: z.string().optional().describe("Variety name (e.g. 'Cherokee Purple')"),
      plantingId: z.string().optional().describe("Planting ID to link this harvest to"),
      spaceId: z.string().optional().describe("Space ID where this was harvested"),
      quantity: z.number().optional().describe("Number of items harvested (e.g. 12 tomatoes)"),
      quantityUnit: z.string().optional().describe("Unit for quantity (e.g. 'fruits', 'heads', 'bunches')"),
      weightOz: z.number().optional().describe("Weight in ounces"),
      harvestedAt: z.string().optional().describe("ISO date when harvested (defaults to now)"),
      quality: z.string().optional().describe("Quality rating: 'excellent', 'good', 'fair', 'poor'"),
      notes: z.string().optional().describe("Notes about this harvest"),
    },
    async (params) => {
      try {
        const result = await harvestService.create(userId, params);
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        console.error("[mcp] tool error:", e);
        return { content: [{ type: "text" as const, text: "An error occurred. Please try again." }], isError: true };
      }
    },
  );

  server.tool(
    "updateHarvest",
    "Update a harvest record",
    {
      harvestId: z.string().describe("Harvest ID"),
      quantity: z.number().optional().describe("Number of items harvested"),
      quantityUnit: z.string().optional().describe("Unit for quantity"),
      weightOz: z.number().optional().describe("Weight in ounces"),
      harvestedAt: z.string().optional().describe("ISO date when harvested"),
      quality: z.string().optional().describe("Quality rating"),
      notes: z.string().optional().describe("Notes"),
    },
    async ({ harvestId, ...params }) => {
      try {
        const result = await harvestService.update(userId, harvestId, params);
        if (!result) return { content: [{ type: "text" as const, text: "Harvest not found" }], isError: true };
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        console.error("[mcp] tool error:", e);
        return { content: [{ type: "text" as const, text: "An error occurred. Please try again." }], isError: true };
      }
    },
  );

  server.tool(
    "deleteHarvest",
    "Delete a harvest record",
    { harvestId: z.string().describe("Harvest ID") },
    async ({ harvestId }) => {
      try {
        await harvestService.del(userId, harvestId);
        return { content: [{ type: "text" as const, text: "Harvest deleted" }] };
      } catch (e) {
        console.error("[mcp] tool error:", e);
        return { content: [{ type: "text" as const, text: "An error occurred. Please try again." }], isError: true };
      }
    },
  );

  server.tool(
    "getHarvestSummary",
    "Get harvest totals grouped by crop/variety for a season. Shows total quantity, total weight, harvest count, and date range per crop.",
    { seasonId: z.string().describe("Season ID") },
    async ({ seasonId }) => {
      try {
        const result = await harvestService.summary(userId, seasonId);
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        console.error("[mcp] tool error:", e);
        return { content: [{ type: "text" as const, text: "An error occurred. Please try again." }], isError: true };
      }
    },
  );
}

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as plantingService from "../../services/planting.service.js";

const plantingStages = [
  "planned", "seeded_indoors", "seedling", "hardening_off",
  "transplanted", "direct_sown", "producing", "finished", "failed",
] as const;

const healthStatuses = ["healthy", "fair", "poor", "critical", "dead"] as const;

export function registerPlantingTools(server: McpServer, userId: string) {
  server.tool(
    "listPlantings",
    "List all plantings in a season. Optionally filter by growth stage. Returns crop, variety, stage, health, space, quantity, and dates.",
    {
      seasonId: z.string().describe("ID of the season"),
      stage: z.enum(plantingStages).optional().describe("Filter by planting stage"),
    },
    async ({ seasonId, stage }) => {
      try {
        const plantings = await plantingService.list(userId, seasonId, stage);
        return { content: [{ type: "text", text: JSON.stringify(plantings, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text", text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  server.tool(
    "getPlanting",
    "Get details of a specific planting by ID",
    {
      plantingId: z.string().describe("Planting ID"),
    },
    async ({ plantingId }) => {
      try {
        const planting = await plantingService.get(userId, plantingId);
        if (!planting) return { content: [{ type: "text" as const, text: "Planting not found" }], isError: true };
        return { content: [{ type: "text" as const, text: JSON.stringify(planting, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text" as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  server.tool(
    "createPlanting",
    "Create a new planting in a season. Auto-links to a catalog entry if a matching crop+variety exists. Source type defaults to 'seed'.",
    {
      seasonId: z.string().describe("ID of the season"),
      crop: z.string().describe("Crop name (e.g. 'Tomato', 'Basil')"),
      variety: z.string().optional().describe("Variety name (e.g. 'Cherokee Purple', 'Genovese')"),
      sourceType: z.enum(["seed", "start"]).optional().describe("Whether grown from seed or purchased as a start"),
      spaceId: z.string().optional().describe("ID of the space to assign this planting to"),
      quantity: z.number().optional().describe("Number of plants/seeds"),
      quantityUnit: z.string().optional().describe("Unit for quantity (e.g. 'seeds', 'plants', 'packets')"),
      notes: z.string().optional().describe("Additional notes"),
    },
    async (params) => {
      try {
        const planting = await plantingService.create(userId, params);
        return { content: [{ type: "text", text: JSON.stringify(planting, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text", text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  server.tool(
    "updatePlanting",
    "Update a planting's variety, quantity, or notes. For stage changes use advancePlantingStage, for health changes use updatePlantingHealth.",
    {
      plantingId: z.string().describe("ID of the planting to update"),
      variety: z.string().optional().describe("New variety name"),
      quantity: z.number().optional().describe("New quantity"),
      quantityUnit: z.string().optional().describe("New quantity unit"),
      notes: z.string().optional().describe("New notes"),
    },
    async ({ plantingId, ...params }) => {
      try {
        const result = await plantingService.update(userId, plantingId, params);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text", text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  server.tool(
    "advancePlantingStage",
    "Advance a planting to a new growth stage. Automatically records timestamps (startedAt, hardenedAt, transplantedAt) and logs a stage_change event.",
    {
      plantingId: z.string().describe("ID of the planting"),
      newStage: z.enum(plantingStages).describe("New growth stage"),
    },
    async ({ plantingId, newStage }) => {
      try {
        const result = await plantingService.advanceStage(userId, plantingId, newStage);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text", text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  server.tool(
    "updatePlantingHealth",
    "Update a planting's health status. Logs an observation event with the health change and optional reason.",
    {
      plantingId: z.string().describe("ID of the planting"),
      health: z.enum(healthStatuses).describe("New health status"),
      reason: z.string().optional().describe("Reason for the health change (e.g. 'aphid infestation', 'drought stress')"),
    },
    async ({ plantingId, health, reason }) => {
      try {
        const result = await plantingService.updateHealth(userId, plantingId, health, reason);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text", text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  server.tool(
    "movePlanting",
    "Move a planting to a different space. Clears any existing grid placements from the old space.",
    {
      plantingId: z.string().describe("ID of the planting to move"),
      newSpaceId: z.string().describe("ID of the destination space"),
    },
    async ({ plantingId, newSpaceId }) => {
      try {
        const result = await plantingService.move(userId, plantingId, newSpaceId);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text", text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  server.tool(
    "deletePlanting",
    "Delete a planting and its grid placements. Cannot be undone.",
    {
      plantingId: z.string().describe("ID of the planting to delete"),
    },
    async ({ plantingId }) => {
      try {
        const result = await plantingService.del(userId, plantingId);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text", text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );
}

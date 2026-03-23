import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as gardenService from "../../services/garden.service.js";

export function registerGardenTools(server: McpServer, userId: string) {
  server.tool(
    "listGardens",
    "List all gardens for the current user. Returns id, name, location, and hardiness zone for each garden.",
    {},
    async () => {
      try {
        const gardens = await gardenService.list(userId);
        return { content: [{ type: "text", text: JSON.stringify(gardens, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text", text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  server.tool(
    "getGarden",
    "Get details of a specific garden by ID",
    {
      gardenId: z.string().describe("Garden ID"),
    },
    async ({ gardenId }) => {
      try {
        const garden = await gardenService.get(userId, gardenId);
        if (!garden) return { content: [{ type: "text" as const, text: "Garden not found" }], isError: true };
        return { content: [{ type: "text" as const, text: JSON.stringify(garden, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text" as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  server.tool(
    "createGarden",
    "Create a new garden. Every garden needs at least a name. Optionally set location, USDA hardiness zone, and GPS coordinates.",
    {
      name: z.string().describe("Garden name"),
      location: z.string().optional().describe("Garden location description (e.g. 'Backyard', '123 Main St')"),
      hardinessZone: z.string().optional().describe("USDA hardiness zone (e.g. '7b')"),
      latitude: z.number().optional().describe("Latitude coordinate"),
      longitude: z.number().optional().describe("Longitude coordinate"),
    },
    async (params) => {
      try {
        const garden = await gardenService.create(userId, params);
        return { content: [{ type: "text", text: JSON.stringify(garden, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text", text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  server.tool(
    "updateGarden",
    "Update an existing garden's details. Only provided fields are changed.",
    {
      gardenId: z.string().describe("ID of the garden to update"),
      name: z.string().optional().describe("New garden name"),
      location: z.string().optional().describe("New location description"),
      hardinessZone: z.string().optional().describe("New USDA hardiness zone"),
      latitude: z.number().optional().describe("New latitude coordinate"),
      longitude: z.number().optional().describe("New longitude coordinate"),
    },
    async ({ gardenId, ...params }) => {
      try {
        const result = await gardenService.update(userId, gardenId, params);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text", text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  server.tool(
    "deleteGarden",
    "Delete a garden and ALL its data (seasons, spaces, plantings, tasks, events). This is a cascade delete and cannot be undone.",
    {
      gardenId: z.string().describe("ID of the garden to delete"),
    },
    async ({ gardenId }) => {
      try {
        const result = await gardenService.del(userId, gardenId);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text", text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );
}

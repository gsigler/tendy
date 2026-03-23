import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as spaceService from "../../services/space.service.js";

export function registerSpaceTools(server: McpServer, userId: string) {
  server.tool(
    "listSpaces",
    "List all spaces (beds, trays, containers, etc.) in a season, ordered by sort order.",
    {
      seasonId: z.string().describe("ID of the season"),
    },
    async ({ seasonId }) => {
      try {
        const spaces = await spaceService.list(userId, seasonId);
        return { content: [{ type: "text", text: JSON.stringify(spaces, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text", text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  server.tool(
    "getSpace",
    "Get details of a specific space by ID",
    {
      spaceId: z.string().describe("Space ID"),
    },
    async ({ spaceId }) => {
      try {
        const space = await spaceService.get(userId, spaceId);
        if (!space) return { content: [{ type: "text" as const, text: "Space not found" }], isError: true };
        return { content: [{ type: "text" as const, text: JSON.stringify(space, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text" as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  server.tool(
    "createSpace",
    "Create a new space in a season. Uses upsert: if a space with the same season+name exists, returns the existing one. Types: RaisedBed, Tray, Container, RowBed, Shelf, HardeningArea.",
    {
      seasonId: z.string().describe("ID of the season"),
      name: z.string().describe("Space name (e.g. 'Bed A', 'Seed Tray 1')"),
      type: z.enum(["RaisedBed", "Tray", "Container", "RowBed", "Shelf", "HardeningArea"]).describe("Type of growing space"),
      width: z.number().optional().describe("Width of the space"),
      length: z.number().optional().describe("Length of the space"),
      unit: z.enum(["ft", "in", "m"]).optional().describe("Unit for width/length"),
      sunExposure: z.enum(["full_sun", "partial_sun", "partial_shade", "full_shade"]).optional().describe("Sun exposure level"),
      posX: z.number().optional().describe("X position on garden map"),
      posY: z.number().optional().describe("Y position on garden map"),
      notes: z.string().optional().describe("Additional notes about this space"),
    },
    async (params) => {
      try {
        const space = await spaceService.create(userId, params);
        return { content: [{ type: "text", text: JSON.stringify(space, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text", text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  server.tool(
    "updateSpace",
    "Update an existing space's properties. Only provided fields are changed.",
    {
      spaceId: z.string().describe("ID of the space to update"),
      name: z.string().optional().describe("New space name"),
      type: z.enum(["RaisedBed", "Tray", "Container", "RowBed", "Shelf", "HardeningArea"]).optional().describe("New space type"),
      width: z.number().optional().describe("New width"),
      length: z.number().optional().describe("New length"),
      posX: z.number().optional().describe("New X position on garden map"),
      posY: z.number().optional().describe("New Y position on garden map"),
      sunExposure: z.enum(["full_sun", "partial_sun", "partial_shade", "full_shade"]).optional().describe("New sun exposure level"),
      notes: z.string().optional().describe("New notes"),
    },
    async ({ spaceId, ...params }) => {
      try {
        const result = await spaceService.update(userId, spaceId, params);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text", text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  server.tool(
    "deleteSpace",
    "Delete a space. Plantings in this space are unlinked (not deleted), and grid placements are removed.",
    {
      spaceId: z.string().describe("ID of the space to delete"),
    },
    async ({ spaceId }) => {
      try {
        const result = await spaceService.del(userId, spaceId);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text", text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  server.tool(
    "getSpaceGrid",
    "Get the grid layout for a space, showing which plantings occupy which cells. Returns space dimensions and all cell placements with crop info.",
    {
      spaceId: z.string().describe("ID of the space"),
    },
    async ({ spaceId }) => {
      try {
        const grid = await spaceService.getGrid(userId, spaceId);
        return { content: [{ type: "text", text: JSON.stringify(grid, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text", text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  server.tool(
    "placeOnGrid",
    "Place a planting on specific grid cells within a space. Provide the cells as an array of {row, col} objects.",
    {
      spaceId: z.string().describe("ID of the space"),
      plantingId: z.string().describe("ID of the planting to place"),
      cells: z.array(z.object({
        row: z.number().describe("Row index (0-based)"),
        col: z.number().describe("Column index (0-based)"),
      })).describe("Array of grid cells to occupy"),
    },
    async (params) => {
      try {
        const result = await spaceService.placeOnGrid(userId, params);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text", text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  server.tool(
    "removeFromGrid",
    "Remove a planting from all grid cells in a space.",
    {
      spaceId: z.string().describe("ID of the space"),
      plantingId: z.string().describe("ID of the planting to remove from the grid"),
    },
    async (params) => {
      try {
        const result = await spaceService.removeFromGrid(userId, params);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text", text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );
}

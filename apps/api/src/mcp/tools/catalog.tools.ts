import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as catalogService from "../../services/catalog.service.js";

const sunOptions = ["full_sun", "partial_sun", "partial_shade", "full_shade"] as const;

export function registerCatalogTools(server: McpServer, userId: string) {
  server.tool(
    "searchCatalog",
    "Search the user's seed/plant catalog by crop name. Returns matching entries with growing info.",
    {
      query: z.string().describe("Search query (matched against crop name, case-insensitive)"),
    },
    async ({ query }) => {
      try {
        const results = await catalogService.search(userId, query);
        return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
      } catch (e) {
        console.error("[mcp] tool error:", e);
        return { content: [{ type: "text", text: "An error occurred. Please try again." }], isError: true };
      }
    },
  );

  server.tool(
    "createCatalogEntry",
    "Add a new entry to the seed/plant catalog with growing information like days to maturity, spacing, and indoor start timing.",
    {
      crop: z.string().describe("Crop name (e.g. 'Tomato')"),
      variety: z.string().optional().describe("Variety name (e.g. 'Cherokee Purple')"),
      vendor: z.string().optional().describe("Seed vendor/source"),
      sourceType: z.enum(["seed", "start"]).optional().describe("Seed or start"),
      daysToMaturity: z.number().optional().describe("Days from transplant to harvest"),
      startIndoorsWeeks: z.number().optional().describe("Weeks before last frost to start indoors"),
      minNightTemp: z.number().optional().describe("Minimum night temperature (F) for transplanting"),
      spacingInches: z.number().optional().describe("Plant spacing in inches"),
      plantsPerSquare: z.number().optional().describe("Plants per square foot (for SFG method)"),
      sun: z.enum(sunOptions).optional().describe("Sun requirement"),
      growthHabit: z.string().optional().describe("Growth habit (e.g. 'determinate', 'indeterminate', 'bush')"),
      notes: z.string().optional().describe("Additional notes"),
    },
    async (params) => {
      try {
        const entry = await catalogService.create(userId, params);
        return { content: [{ type: "text", text: JSON.stringify(entry, null, 2) }] };
      } catch (e) {
        console.error("[mcp] tool error:", e);
        return { content: [{ type: "text", text: "An error occurred. Please try again." }], isError: true };
      }
    },
  );

  server.tool(
    "getCatalogEntry",
    "Get full details of a catalog entry including all growing information.",
    {
      catalogId: z.string().describe("ID of the catalog entry"),
    },
    async ({ catalogId }) => {
      try {
        const entry = await catalogService.get(userId, catalogId);
        return { content: [{ type: "text", text: JSON.stringify(entry, null, 2) }] };
      } catch (e) {
        console.error("[mcp] tool error:", e);
        return { content: [{ type: "text", text: "An error occurred. Please try again." }], isError: true };
      }
    },
  );

  server.tool(
    "updateCatalogEntry",
    "Update a catalog entry's growing information, rating, or review notes. Only provided fields are changed.",
    {
      catalogId: z.string().describe("ID of the catalog entry to update"),
      vendor: z.string().optional().describe("New vendor"),
      sourceType: z.enum(["seed", "start"]).optional().describe("New source type"),
      daysToMaturity: z.number().optional().describe("New days to maturity"),
      startIndoorsWeeks: z.number().optional().describe("New weeks to start indoors before last frost"),
      minNightTemp: z.number().optional().describe("New minimum night temperature (F)"),
      spacingInches: z.number().optional().describe("New spacing in inches"),
      plantsPerSquare: z.number().optional().describe("New plants per square foot"),
      sun: z.enum(sunOptions).optional().describe("New sun requirement"),
      growthHabit: z.string().optional().describe("New growth habit"),
      rating: z.number().optional().describe("Rating (1-5) based on growing experience"),
      wouldGrowAgain: z.number().optional().describe("Would grow again? 1 = yes, 0 = no"),
      yieldNotes: z.string().optional().describe("Notes about yield performance"),
      notes: z.string().optional().describe("New notes"),
    },
    async ({ catalogId, ...params }) => {
      try {
        const result = await catalogService.update(userId, catalogId, params);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        console.error("[mcp] tool error:", e);
        return { content: [{ type: "text", text: "An error occurred. Please try again." }], isError: true };
      }
    },
  );

  server.tool(
    "deleteCatalogEntry",
    "Delete a catalog entry. Plantings linked to this entry are unlinked (not deleted).",
    {
      catalogId: z.string().describe("ID of the catalog entry to delete"),
    },
    async ({ catalogId }) => {
      try {
        const result = await catalogService.del(userId, catalogId);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        console.error("[mcp] tool error:", e);
        return { content: [{ type: "text", text: "An error occurred. Please try again." }], isError: true };
      }
    },
  );
}

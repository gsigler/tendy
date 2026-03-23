import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as eventService from "../../services/event.service.js";

const eventTypes = [
  "observation", "watering", "fertilizing", "pest",
  "disease", "weather", "stage_change", "planting", "maintenance", "other",
] as const;

export function registerEventTools(server: McpServer, userId: string) {
  server.tool(
    "listRecentEvents",
    "List recent events/observations for a season, ordered by most recent first. Defaults to 20 events.",
    {
      seasonId: z.string().describe("ID of the season"),
      limit: z.number().optional().describe("Max number of events to return (default 20)"),
    },
    async ({ seasonId, limit }) => {
      try {
        const events = await eventService.listRecent(userId, seasonId, limit);
        return { content: [{ type: "text", text: JSON.stringify(events, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text", text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  server.tool(
    "recordEvent",
    "Record a garden event or observation. Types: observation, watering, fertilizing, pest, disease, weather, stage_change, planting, maintenance, other.",
    {
      seasonId: z.string().describe("ID of the season"),
      type: z.enum(eventTypes).describe("Event type"),
      summary: z.string().describe("Description of what happened"),
      plantingId: z.string().optional().describe("ID of related planting"),
      spaceId: z.string().optional().describe("ID of related space"),
      data: z.record(z.unknown()).optional().describe("Additional structured data as key-value pairs"),
    },
    async (params) => {
      try {
        const event = await eventService.record(userId, params);
        return { content: [{ type: "text", text: JSON.stringify(event, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text", text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );

  server.tool(
    "deleteEvent",
    "Delete an event record permanently.",
    {
      eventId: z.string().describe("ID of the event to delete"),
    },
    async ({ eventId }) => {
      try {
        const result = await eventService.del(userId, eventId);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text", text: `Error: ${e instanceof Error ? e.message : String(e)}` }], isError: true };
      }
    },
  );
}

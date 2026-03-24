import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as photoService from "../../services/photo.service.js";

const attachTargetSchema = {
  seasonId: z.string().optional().describe("Season ID to attach this photo to"),
  plantingId: z.string().optional().describe("Planting ID to attach this photo to"),
  harvestId: z.string().optional().describe("Harvest ID to attach this photo to"),
  spaceId: z.string().optional().describe("Space ID to attach this photo to"),
  catalogId: z.string().optional().describe("Catalog entry ID to attach this photo to"),
};

export function registerPhotoTools(server: McpServer, userId: string) {
  server.tool(
    "requestPhotoUpload",
    "Generate a presigned upload URL so a device can PUT a photo directly to cloud storage. Returns a photoId (already saved in the DB) and an uploadUrl valid for 15 minutes. Requires R2 storage to be configured on the server.",
    {
      ...attachTargetSchema,
      contentType: z
        .string()
        .optional()
        .describe("MIME type of the image (default: image/jpeg)"),
      caption: z.string().optional().describe("Optional caption for the photo"),
      takenAt: z
        .string()
        .optional()
        .describe("ISO date when the photo was taken (defaults to now)"),
    },
    async (params) => {
      try {
        const result = await photoService.requestUploadUrl(userId, params);
        if ("error" in result)
          return {
            content: [{ type: "text" as const, text: String(result.error) }],
            isError: true,
          };
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (e) {
        console.error("[mcp] tool error:", e);
        return {
          content: [{ type: "text" as const, text: "An error occurred. Please try again." }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "attachPhotoUrl",
    "Attach an externally-hosted photo URL to a garden entity (season, planting, harvest, space, or catalog entry). Use this when the photo is already hosted somewhere (e.g. a URL the user shared). No file upload needed.",
    {
      url: z.string().describe("Public URL of the photo"),
      ...attachTargetSchema,
      caption: z.string().optional().describe("Optional caption for the photo"),
      takenAt: z
        .string()
        .optional()
        .describe("ISO date when the photo was taken (defaults to now)"),
    },
    async (params) => {
      try {
        const result = await photoService.attachUrl(userId, params);
        if ("error" in result)
          return {
            content: [{ type: "text" as const, text: String(result.error) }],
            isError: true,
          };
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (e) {
        console.error("[mcp] tool error:", e);
        return {
          content: [{ type: "text" as const, text: "An error occurred. Please try again." }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "listPhotos",
    "List photos for a given entity. Provide at least one of: seasonId, plantingId, harvestId, spaceId, or catalogId. If multiple filters are provided, photos matching any of them are returned.",
    {
      seasonId: z.string().optional().describe("Filter by season ID"),
      plantingId: z.string().optional().describe("Filter by planting ID"),
      harvestId: z.string().optional().describe("Filter by harvest ID"),
      spaceId: z.string().optional().describe("Filter by space ID"),
      catalogId: z.string().optional().describe("Filter by catalog entry ID"),
    },
    async (params) => {
      try {
        const result = await photoService.list(userId, params);
        if ("error" in result)
          return {
            content: [{ type: "text" as const, text: String(result.error) }],
            isError: true,
          };
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (e) {
        console.error("[mcp] tool error:", e);
        return {
          content: [{ type: "text" as const, text: "An error occurred. Please try again." }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "getPhoto",
    "Get details of a single photo by ID",
    { photoId: z.string().describe("Photo ID") },
    async ({ photoId }) => {
      try {
        const result = await photoService.get(userId, photoId);
        if (!result)
          return {
            content: [{ type: "text" as const, text: "Photo not found" }],
            isError: true,
          };
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (e) {
        console.error("[mcp] tool error:", e);
        return {
          content: [{ type: "text" as const, text: "An error occurred. Please try again." }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "updatePhoto",
    "Update a photo's caption or takenAt timestamp",
    {
      photoId: z.string().describe("Photo ID"),
      caption: z.string().optional().describe("New caption"),
      takenAt: z.string().optional().describe("New ISO date for when the photo was taken"),
    },
    async ({ photoId, ...params }) => {
      try {
        const result = await photoService.update(userId, photoId, params);
        if (!result || "error" in result)
          return {
            content: [{ type: "text" as const, text: "Photo not found" }],
            isError: true,
          };
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (e) {
        console.error("[mcp] tool error:", e);
        return {
          content: [{ type: "text" as const, text: "An error occurred. Please try again." }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "deletePhoto",
    "Delete a photo. If the photo was uploaded to R2 storage, it is also removed from the bucket.",
    { photoId: z.string().describe("Photo ID") },
    async ({ photoId }) => {
      try {
        const result = await photoService.del(userId, photoId);
        if (result && "error" in result)
          return {
            content: [{ type: "text" as const, text: result.error }],
            isError: true,
          };
        return { content: [{ type: "text" as const, text: "Photo deleted" }] };
      } catch (e) {
        console.error("[mcp] tool error:", e);
        return {
          content: [{ type: "text" as const, text: "An error occurred. Please try again." }],
          isError: true,
        };
      }
    },
  );
}

import { tool } from "ai";
import { z } from "zod";
import { eq, and, desc, asc, lte, gt, notInArray, ilike } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  gardens,
  seasons,
  spaces,
  plantings,
  catalogEntries,
  catalogReviews,
  tasks,
  events,
  gridPlacements,
} from "../db/schema.js";
import {
  PlantingStage,
  HealthStatus,
  SpaceType,
  TaskType,
  TaskPriority,
  SourceType,
  EventType,
} from "@tendy/shared";

async function verifySeasonOwnership(
  userId: string,
  seasonId: string,
): Promise<boolean> {
  const [season] = await db
    .select({ gardenUserId: gardens.userId })
    .from(seasons)
    .innerJoin(gardens, eq(seasons.gardenId, gardens.id))
    .where(and(eq(seasons.id, seasonId), eq(gardens.userId, userId)));
  return !!season;
}

export function createTools(userId: string) {
  return {
    // ── Garden Tools ─────────────────────────────────────────────────────

    listGardens: tool({
      description: "List all gardens for the current user",
      parameters: z.object({}),
      execute: async () => {
        const rows = await db
          .select()
          .from(gardens)
          .where(eq(gardens.userId, userId))
          .orderBy(desc(gardens.updatedAt));
        return rows.map((g) => ({
          id: g.id,
          name: g.name,
          location: g.location,
          hardinessZone: g.hardinessZone,
        }));
      },
    }),

    createGarden: tool({
      description:
        "Create a new garden. Ask for name and location at minimum.",
      parameters: z.object({
        name: z.string().describe("Garden name"),
        location: z.string().optional().describe("City/state or address"),
        hardinessZone: z.string().optional().describe("USDA hardiness zone"),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
      }),
      execute: async (params) => {
        const [garden] = await db
          .insert(gardens)
          .values({ ...params, userId })
          .returning();
        return {
          id: garden.id,
          name: garden.name,
          location: garden.location,
          hardinessZone: garden.hardinessZone,
        };
      },
    }),

    updateGarden: tool({
      description: "Update a garden's name, location, or hardiness zone",
      parameters: z.object({
        gardenId: z.string().uuid(),
        name: z.string().optional(),
        location: z.string().optional(),
        hardinessZone: z.string().optional(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
      }),
      execute: async ({ gardenId, ...updates }) => {
        const [updated] = await db
          .update(gardens)
          .set({ ...updates, updatedAt: new Date() })
          .where(and(eq(gardens.id, gardenId), eq(gardens.userId, userId)))
          .returning();
        if (!updated) return { error: "Garden not found" };
        return {
          id: updated.id,
          name: updated.name,
          location: updated.location,
          hardinessZone: updated.hardinessZone,
        };
      },
    }),

    deleteGarden: tool({
      description:
        "Delete a garden and ALL its seasons, spaces, plantings, tasks, and events. Only call after user confirms.",
      parameters: z.object({
        gardenId: z.string().uuid(),
      }),
      execute: async ({ gardenId }) => {
        const [garden] = await db
          .select()
          .from(gardens)
          .where(and(eq(gardens.id, gardenId), eq(gardens.userId, userId)));
        if (!garden) return { error: "Garden not found" };

        // Get all seasons to cascade delete
        const seasonRows = await db
          .select({ id: seasons.id })
          .from(seasons)
          .where(eq(seasons.gardenId, gardenId));

        for (const s of seasonRows) {
          const plantingRows = await db
            .select({ id: plantings.id })
            .from(plantings)
            .where(eq(plantings.seasonId, s.id));
          for (const p of plantingRows) {
            await db.delete(gridPlacements).where(eq(gridPlacements.plantingId, p.id));
          }
          await db.delete(events).where(eq(events.seasonId, s.id));
          await db.delete(tasks).where(eq(tasks.seasonId, s.id));
          await db.delete(plantings).where(eq(plantings.seasonId, s.id));
          await db.delete(spaces).where(eq(spaces.seasonId, s.id));
        }
        await db.delete(seasons).where(eq(seasons.gardenId, gardenId));
        await db.delete(gardens).where(eq(gardens.id, gardenId));
        return { deleted: true, gardenId };
      },
    }),

    // ── Season Tools ─────────────────────────────────────────────────────

    listSeasons: tool({
      description: "List all seasons for a garden",
      parameters: z.object({
        gardenId: z.string().uuid().describe("Garden ID"),
      }),
      execute: async ({ gardenId }) => {
        const rows = await db
          .select()
          .from(seasons)
          .where(eq(seasons.gardenId, gardenId))
          .orderBy(desc(seasons.year));
        return rows.map((s) => ({
          id: s.id,
          year: s.year,
          name: s.name,
          status: s.status,
          lastFrostDate: s.lastFrostDate?.toISOString() ?? null,
          firstFrostDate: s.firstFrostDate?.toISOString() ?? null,
        }));
      },
    }),

    createSeason: tool({
      description:
        "Create a new season for a garden. Include frost dates if known. Returns existing season if one with the same name and year already exists.",
      parameters: z.object({
        gardenId: z.string().uuid(),
        year: z.number().int(),
        name: z.string().describe("e.g. 'Spring 2026', 'Summer 2026'"),
        lastFrostDate: z
          .string()
          .optional()
          .describe("Last spring frost date ISO string"),
        firstFrostDate: z
          .string()
          .optional()
          .describe("First fall frost date ISO string"),
      }),
      execute: async ({ gardenId, year, name, lastFrostDate, firstFrostDate }) => {
        // Verify garden belongs to user
        const [garden] = await db
          .select()
          .from(gardens)
          .where(and(eq(gardens.id, gardenId), eq(gardens.userId, userId)));
        if (!garden) return { error: "Garden not found" };

        // Check for existing season with same name+year
        const [existing] = await db
          .select()
          .from(seasons)
          .where(
            and(
              eq(seasons.gardenId, gardenId),
              eq(seasons.year, year),
              eq(seasons.name, name),
            ),
          );
        if (existing) {
          // Update frost dates if provided
          if (lastFrostDate || firstFrostDate) {
            const [updated] = await db
              .update(seasons)
              .set({
                ...(lastFrostDate ? { lastFrostDate: new Date(lastFrostDate) } : {}),
                ...(firstFrostDate ? { firstFrostDate: new Date(firstFrostDate) } : {}),
                updatedAt: new Date(),
              })
              .where(eq(seasons.id, existing.id))
              .returning();
            return {
              id: updated.id,
              year: updated.year,
              name: updated.name,
              status: updated.status,
              alreadyExisted: true,
            };
          }
          return {
            id: existing.id,
            year: existing.year,
            name: existing.name,
            status: existing.status,
            alreadyExisted: true,
          };
        }

        const [season] = await db
          .insert(seasons)
          .values({
            gardenId,
            year,
            name,
            lastFrostDate: lastFrostDate ? new Date(lastFrostDate) : null,
            firstFrostDate: firstFrostDate ? new Date(firstFrostDate) : null,
          })
          .returning();
        return {
          id: season.id,
          year: season.year,
          name: season.name,
          status: season.status,
        };
      },
    }),

    updateSeason: tool({
      description: "Update a season's frost dates or status",
      parameters: z.object({
        seasonId: z.string().uuid(),
        lastFrostDate: z.string().optional(),
        firstFrostDate: z.string().optional(),
        status: z.enum(["planning", "active", "complete"]).optional(),
      }),
      execute: async ({ seasonId, lastFrostDate, firstFrostDate, status }) => {
        if (!(await verifySeasonOwnership(userId, seasonId))) {
          return { error: "Season not found" };
        }
        const [updated] = await db
          .update(seasons)
          .set({
            ...(lastFrostDate ? { lastFrostDate: new Date(lastFrostDate) } : {}),
            ...(firstFrostDate ? { firstFrostDate: new Date(firstFrostDate) } : {}),
            ...(status ? { status } : {}),
            updatedAt: new Date(),
          })
          .where(eq(seasons.id, seasonId))
          .returning();
        if (!updated) return { error: "Season not found" };
        return {
          id: updated.id,
          name: updated.name,
          status: updated.status,
          lastFrostDate: updated.lastFrostDate?.toISOString() ?? null,
          firstFrostDate: updated.firstFrostDate?.toISOString() ?? null,
        };
      },
    }),

    deleteSeason: tool({
      description:
        "Delete a season and all its spaces, plantings, tasks, and events. Only call after user confirms.",
      parameters: z.object({
        seasonId: z.string().uuid(),
      }),
      execute: async ({ seasonId }) => {
        if (!(await verifySeasonOwnership(userId, seasonId))) {
          return { error: "Season not found" };
        }
        // Delete in FK order
        const plantingRows = await db
          .select({ id: plantings.id })
          .from(plantings)
          .where(eq(plantings.seasonId, seasonId));
        const plantingIds = plantingRows.map((p) => p.id);
        if (plantingIds.length > 0) {
          for (const pid of plantingIds) {
            await db.delete(gridPlacements).where(eq(gridPlacements.plantingId, pid));
          }
        }
        await db.delete(events).where(eq(events.seasonId, seasonId));
        await db.delete(tasks).where(eq(tasks.seasonId, seasonId));
        await db.delete(plantings).where(eq(plantings.seasonId, seasonId));
        await db.delete(spaces).where(eq(spaces.seasonId, seasonId));
        await db.delete(seasons).where(eq(seasons.id, seasonId));
        return { deleted: true, seasonId };
      },
    }),

    getSeasonSummary: tool({
      description:
        "Get a summary of a season including spaces, planting counts, and task counts",
      parameters: z.object({
        seasonId: z.string().uuid(),
      }),
      execute: async ({ seasonId }) => {
        const [season] = await db
          .select()
          .from(seasons)
          .where(eq(seasons.id, seasonId));
        if (!season) return { error: "Season not found" };

        const spaceList = await db
          .select()
          .from(spaces)
          .where(eq(spaces.seasonId, seasonId));
        const plantingList = await db
          .select()
          .from(plantings)
          .where(eq(plantings.seasonId, seasonId));
        const taskList = await db
          .select()
          .from(tasks)
          .where(eq(tasks.seasonId, seasonId));

        return {
          season: {
            id: season.id,
            name: season.name,
            year: season.year,
            status: season.status,
            lastFrostDate: season.lastFrostDate?.toISOString() ?? null,
            firstFrostDate: season.firstFrostDate?.toISOString() ?? null,
          },
          spaces: spaceList.map((s) => ({
            id: s.id,
            name: s.name,
            type: s.type,
          })),
          plantingCount: plantingList.length,
          plantingsByStage: Object.fromEntries(
            Object.entries(
              plantingList.reduce(
                (acc, p) => {
                  acc[p.stage] = (acc[p.stage] ?? 0) + 1;
                  return acc;
                },
                {} as Record<string, number>,
              ),
            ),
          ),
          taskCounts: {
            pending: taskList.filter((t) => t.status === "pending").length,
            completed: taskList.filter((t) => t.status === "completed").length,
            overdue: taskList.filter(
              (t) =>
                t.status === "pending" && t.dueAt && t.dueAt < new Date(),
            ).length,
          },
        };
      },
    }),

    // ── Space Tools ──────────────────────────────────────────────────────

    listSpaces: tool({
      description: "List all spaces (beds, trays, containers) in a season",
      parameters: z.object({
        seasonId: z.string().uuid(),
      }),
      execute: async ({ seasonId }) => {
        const rows = await db
          .select()
          .from(spaces)
          .where(eq(spaces.seasonId, seasonId))
          .orderBy(asc(spaces.sortOrder));
        return rows.map((s) => ({
          id: s.id,
          name: s.name,
          type: s.type,
          width: s.width,
          length: s.length,
          sunExposure: s.sunExposure,
        }));
      },
    }),

    createSpace: tool({
      description:
        "Create a new growing space. Returns existing space if one with the same name already exists in the season. Types: RaisedBed, Tray, Container, RowBed, Shelf, HardeningArea",
      parameters: z.object({
        seasonId: z.string().uuid(),
        name: z.string().describe("e.g. 'Sunny Bed', 'Herb Container'"),
        type: SpaceType,
        width: z.number().int().optional().describe("Width in specified unit"),
        length: z.number().int().optional().describe("Length in specified unit"),
        unit: z.enum(["ft", "in", "m"]).optional(),
        sunExposure: z
          .enum(["full_sun", "partial_sun", "partial_shade", "full_shade"])
          .optional(),
        notes: z.string().optional(),
      }),
      execute: async (params) => {
        if (!(await verifySeasonOwnership(userId, params.seasonId))) {
          return { error: "Season not found" };
        }
        // Check for existing space with same name
        const [existing] = await db
          .select()
          .from(spaces)
          .where(
            and(
              eq(spaces.seasonId, params.seasonId),
              eq(spaces.name, params.name),
            ),
          );
        if (existing) {
          return {
            id: existing.id,
            name: existing.name,
            type: existing.type,
            width: existing.width,
            length: existing.length,
            alreadyExisted: true,
          };
        }
        const [space] = await db.insert(spaces).values(params).returning();
        return {
          id: space.id,
          name: space.name,
          type: space.type,
          width: space.width,
          length: space.length,
        };
      },
    }),

    updateSpace: tool({
      description: "Update a space's name, dimensions, sun exposure, or notes",
      parameters: z.object({
        spaceId: z.string().uuid(),
        name: z.string().optional(),
        type: SpaceType.optional(),
        width: z.number().int().optional(),
        length: z.number().int().optional(),
        sunExposure: z
          .enum(["full_sun", "partial_sun", "partial_shade", "full_shade"])
          .optional(),
        notes: z.string().optional(),
      }),
      execute: async ({ spaceId, ...updates }) => {
        const [updated] = await db
          .update(spaces)
          .set({ ...updates, updatedAt: new Date() })
          .where(eq(spaces.id, spaceId))
          .returning();
        if (!updated) return { error: "Space not found" };
        return {
          id: updated.id,
          name: updated.name,
          type: updated.type,
          width: updated.width,
          length: updated.length,
          sunExposure: updated.sunExposure,
        };
      },
    }),

    deleteSpace: tool({
      description:
        "Delete a space and remove all grid placements in it. Plantings are NOT deleted but unlinked. Only call after user confirms.",
      parameters: z.object({
        spaceId: z.string().uuid(),
      }),
      execute: async ({ spaceId }) => {
        await db.delete(gridPlacements).where(eq(gridPlacements.spaceId, spaceId));
        // Unlink plantings from this space
        await db
          .update(plantings)
          .set({ spaceId: null, updatedAt: new Date() })
          .where(eq(plantings.spaceId, spaceId));
        await db.delete(spaces).where(eq(spaces.id, spaceId));
        return { deleted: true, spaceId };
      },
    }),

    getSpaceGrid: tool({
      description:
        "Get the grid layout for a space showing what is planted where",
      parameters: z.object({
        spaceId: z.string().uuid(),
      }),
      execute: async ({ spaceId }) => {
        const [space] = await db
          .select()
          .from(spaces)
          .where(eq(spaces.id, spaceId));
        if (!space) return { error: "Space not found" };

        const placements = await db
          .select({
            row: gridPlacements.row,
            col: gridPlacements.col,
            plantingId: gridPlacements.plantingId,
            crop: plantings.crop,
            variety: plantings.variety,
            stage: plantings.stage,
            health: plantings.health,
          })
          .from(gridPlacements)
          .innerJoin(plantings, eq(gridPlacements.plantingId, plantings.id))
          .where(eq(gridPlacements.spaceId, spaceId));

        return {
          space: {
            id: space.id,
            name: space.name,
            width: space.width,
            length: space.length,
          },
          placements,
        };
      },
    }),

    drawSpaceGrid: tool({
      description: `Draw an ASCII art grid of a space showing exactly what is planted in each cell.
Use this when the user wants to SEE their garden layout visually. Shows crop abbreviations
in a grid with row/col coordinates. Empty cells show "·". Includes a legend mapping
abbreviations to full crop names with health status.`,
      parameters: z.object({
        spaceId: z.string().uuid(),
      }),
      execute: async ({ spaceId }) => {
        const [space] = await db
          .select()
          .from(spaces)
          .where(eq(spaces.id, spaceId));
        if (!space) return { error: "Space not found" };

        const width = space.width || 4;
        const length = space.length || 4;

        const placementRows = await db
          .select({
            row: gridPlacements.row,
            col: gridPlacements.col,
            plantingId: gridPlacements.plantingId,
            crop: plantings.crop,
            variety: plantings.variety,
            stage: plantings.stage,
            health: plantings.health,
          })
          .from(gridPlacements)
          .innerJoin(plantings, eq(gridPlacements.plantingId, plantings.id))
          .where(eq(gridPlacements.spaceId, spaceId));

        // Build abbreviation map: first 3 chars of crop, disambiguate with variety
        const plantingAbbrevs = new Map<string, string>();
        const usedAbbrevs = new Set<string>();
        for (const p of placementRows) {
          if (plantingAbbrevs.has(p.plantingId)) continue;
          let abbrev = p.crop.slice(0, 3).toUpperCase();
          if (usedAbbrevs.has(abbrev) && p.variety) {
            abbrev = (p.crop[0] + p.variety.slice(0, 2)).toUpperCase();
          }
          let attempt = abbrev;
          let i = 2;
          while (usedAbbrevs.has(attempt)) {
            attempt = abbrev.slice(0, 2) + String(i);
            i++;
          }
          usedAbbrevs.add(attempt);
          plantingAbbrevs.set(p.plantingId, attempt);
        }

        // Build grid
        const grid: string[][] = Array.from({ length }, () =>
          Array.from({ length: width }, () => " · "),
        );
        for (const p of placementRows) {
          const abbrev = plantingAbbrevs.get(p.plantingId) || "???";
          if (p.row < length && p.col < width) {
            grid[p.row][p.col] = abbrev.padStart(3);
          }
        }

        // Column headers
        const colHeaders =
          "    " +
          Array.from({ length: width }, (_, i) => String(i).padStart(3)).join("");
        const separator = "   +" + "---".repeat(width) + "+";

        let ascii = `${space.name} (${width}×${length} ${space.unit || "ft"}, ${space.type})\n\n`;
        ascii += colHeaders + "\n";
        ascii += separator + "\n";
        for (let r = 0; r < length; r++) {
          ascii += String(r).padStart(2) + " |" + grid[r].join("") + " |\n";
        }
        ascii += separator + "\n";

        // Legend
        const legend: string[] = [];
        const seen = new Set<string>();
        for (const p of placementRows) {
          if (seen.has(p.plantingId)) continue;
          seen.add(p.plantingId);
          const abbrev = plantingAbbrevs.get(p.plantingId) || "???";
          const name = p.variety ? `${p.crop} (${p.variety})` : p.crop;
          const healthIcon =
            p.health === "healthy" ? "" :
            p.health === "fair" ? " ⚠" :
            p.health === "poor" ? " ⚠⚠" :
            p.health === "critical" ? " 🔴" : " 💀";
          legend.push(`${abbrev.padStart(3)} = ${name} [${p.stage}]${healthIcon}`);
        }
        if (legend.length > 0) {
          ascii += "\nLegend:\n" + legend.join("\n");
        }

        // Count empty cells
        const totalCells = width * length;
        const usedCells = placementRows.length;
        ascii += `\n\n${usedCells}/${totalCells} cells occupied`;

        // Build structured grid data for rich rendering
        const gridData: Array<{
          row: number;
          col: number;
          crop: string | null;
          variety: string | null;
          stage: string | null;
          health: string | null;
          plantingId: string | null;
          abbrev: string | null;
        }> = [];
        for (let r = 0; r < length; r++) {
          for (let c = 0; c < width; c++) {
            const p = placementRows.find((pl) => pl.row === r && pl.col === c);
            gridData.push({
              row: r,
              col: c,
              crop: p?.crop ?? null,
              variety: p?.variety ?? null,
              stage: p?.stage ?? null,
              health: p?.health ?? null,
              plantingId: p?.plantingId ?? null,
              abbrev: p ? (plantingAbbrevs.get(p.plantingId) ?? null) : null,
            });
          }
        }

        return {
          _displayType: "space_grid",
          ascii,
          spaceName: space.name,
          spaceType: space.type,
          width,
          length,
          unit: space.unit || "ft",
          plantingCount: seen.size,
          grid: gridData,
        };
      },
    }),

    drawGardenMap: tool({
      description: `Draw an ASCII overview of all spaces in a season with their contents.
Shows each space as a labeled box with a summary of what's planted inside.
Use this for a bird's-eye view of the entire garden layout.`,
      parameters: z.object({
        seasonId: z.string().uuid(),
      }),
      execute: async ({ seasonId }) => {
        const [season] = await db
          .select()
          .from(seasons)
          .where(eq(seasons.id, seasonId));
        if (!season) return { error: "Season not found" };

        const spaceList = await db
          .select()
          .from(spaces)
          .where(eq(spaces.seasonId, seasonId))
          .orderBy(asc(spaces.sortOrder));

        if (spaceList.length === 0) {
          return { ascii: "No spaces set up yet. Create some beds, trays, or containers first." };
        }

        const plantingList = await db
          .select({
            id: plantings.id,
            crop: plantings.crop,
            variety: plantings.variety,
            stage: plantings.stage,
            health: plantings.health,
            spaceId: plantings.spaceId,
          })
          .from(plantings)
          .where(eq(plantings.seasonId, seasonId));

        // Group plantings by space
        const bySpace = new Map<string, typeof plantingList>();
        const unassigned: typeof plantingList = [];
        for (const p of plantingList) {
          if (p.spaceId) {
            const list = bySpace.get(p.spaceId) || [];
            list.push(p);
            bySpace.set(p.spaceId, list);
          } else {
            unassigned.push(p);
          }
        }

        let ascii = `🌱 ${season.name} (${season.year}) — Garden Map\n`;
        ascii += "═".repeat(50) + "\n\n";

        for (const space of spaceList) {
          const dims = space.width && space.length
            ? ` ${space.width}×${space.length}${space.unit || "ft"}`
            : "";
          const header = `${space.name} (${space.type}${dims})`;
          const border = "─".repeat(Math.max(header.length + 2, 30));

          ascii += `┌${border}┐\n`;
          ascii += `│ ${header.padEnd(border.length - 1)}│\n`;
          ascii += `├${border}┤\n`;

          const spacePlantings = bySpace.get(space.id) || [];
          if (spacePlantings.length === 0) {
            ascii += `│ ${"(empty)".padEnd(border.length - 1)}│\n`;
          } else {
            for (const p of spacePlantings) {
              const name = p.variety ? `${p.crop} (${p.variety})` : p.crop;
              const status = `[${p.stage}]`;
              const healthIcon =
                p.health === "healthy" ? "●" :
                p.health === "fair" ? "◐" :
                p.health === "poor" ? "○" : "✕";
              const line = ` ${healthIcon} ${name} ${status}`;
              ascii += `│${line.padEnd(border.length)}│\n`;
            }
          }
          ascii += `└${border}┘\n\n`;
        }

        if (unassigned.length > 0) {
          ascii += `📦 Unassigned Plantings:\n`;
          for (const p of unassigned) {
            const name = p.variety ? `${p.crop} (${p.variety})` : p.crop;
            ascii += `  • ${name} [${p.stage}]\n`;
          }
          ascii += "\n";
        }

        ascii += `Total: ${spaceList.length} spaces, ${plantingList.length} plantings`;
        if (unassigned.length > 0) {
          ascii += ` (${unassigned.length} unassigned)`;
        }

        // Build structured data for rich rendering
        const spacesData = spaceList.map((space) => ({
          id: space.id,
          name: space.name,
          type: space.type,
          width: space.width,
          length: space.length,
          unit: space.unit,
          plantings: (bySpace.get(space.id) || []).map((p) => ({
            id: p.id,
            crop: p.crop,
            variety: p.variety,
            stage: p.stage,
            health: p.health,
          })),
        }));

        return {
          _displayType: "garden_map",
          ascii,
          seasonName: season.name,
          seasonYear: season.year,
          spaces: spacesData,
          unassigned: unassigned.map((p) => ({
            id: p.id,
            crop: p.crop,
            variety: p.variety,
            stage: p.stage,
            health: p.health,
          })),
          spaceCount: spaceList.length,
          plantingCount: plantingList.length,
        };
      },
    }),

    placeOnGrid: tool({
      description: "Assign a planting to specific grid cells in a space",
      parameters: z.object({
        spaceId: z.string().uuid(),
        plantingId: z.string().uuid(),
        cells: z
          .array(z.object({ row: z.number().int(), col: z.number().int() }))
          .describe("List of {row, col} cells to place the planting in"),
      }),
      execute: async ({ spaceId, plantingId, cells }) => {
        const values = cells.map((c) => ({
          spaceId,
          plantingId,
          row: c.row,
          col: c.col,
        }));
        await db.insert(gridPlacements).values(values);
        return { placed: cells.length, spaceId, plantingId };
      },
    }),

    removeFromGrid: tool({
      description: "Remove a planting from all grid cells in a space",
      parameters: z.object({
        spaceId: z.string().uuid(),
        plantingId: z.string().uuid(),
      }),
      execute: async ({ spaceId, plantingId }) => {
        await db
          .delete(gridPlacements)
          .where(
            and(
              eq(gridPlacements.spaceId, spaceId),
              eq(gridPlacements.plantingId, plantingId),
            ),
          );
        return { removed: true, spaceId, plantingId };
      },
    }),

    // ── Planting Tools ───────────────────────────────────────────────────

    listPlantings: tool({
      description:
        "List all plantings in a season, optionally filtered by stage",
      parameters: z.object({
        seasonId: z.string().uuid(),
        stage: PlantingStage.optional(),
      }),
      execute: async ({ seasonId, stage }) => {
        const query = db
          .select({
            id: plantings.id,
            crop: plantings.crop,
            variety: plantings.variety,
            stage: plantings.stage,
            health: plantings.health,
            sourceType: plantings.sourceType,
            spaceName: spaces.name,
            quantity: plantings.quantity,
            quantityUnit: plantings.quantityUnit,
            startedAt: plantings.startedAt,
            notes: plantings.notes,
          })
          .from(plantings)
          .leftJoin(spaces, eq(plantings.spaceId, spaces.id))
          .where(
            stage
              ? and(
                  eq(plantings.seasonId, seasonId),
                  eq(plantings.stage, stage),
                )
              : eq(plantings.seasonId, seasonId),
          )
          .orderBy(asc(plantings.crop));

        const rows = await query;
        return rows.map((r) => ({
          ...r,
          startedAt: r.startedAt?.toISOString() ?? null,
        }));
      },
    }),

    createPlanting: tool({
      description:
        "Create a new planting. Check the catalog first for matching varieties.",
      parameters: z.object({
        seasonId: z.string().uuid(),
        crop: z.string().describe("e.g. 'Tomato', 'Basil'"),
        variety: z.string().optional().describe("e.g. 'Sun Gold', 'Roma'"),
        sourceType: SourceType.optional(),
        spaceId: z.string().uuid().optional().describe("Assign to a space"),
        quantity: z.number().int().optional(),
        quantityUnit: z.string().optional().describe("e.g. 'seeds', 'plants'"),
        notes: z.string().optional(),
      }),
      execute: async (params) => {
        if (!(await verifySeasonOwnership(userId, params.seasonId))) {
          return { error: "Season not found" };
        }
        // Check if catalog entry exists for auto-linking
        let catalogId: string | null = null;
        if (params.variety) {
          const [entry] = await db
            .select()
            .from(catalogEntries)
            .where(
              and(
                eq(catalogEntries.userId, userId),
                eq(catalogEntries.crop, params.crop),
                eq(catalogEntries.variety, params.variety),
              ),
            );
          if (entry) catalogId = entry.id;
        }

        const [planting] = await db
          .insert(plantings)
          .values({
            seasonId: params.seasonId,
            crop: params.crop,
            variety: params.variety,
            sourceType: params.sourceType ?? "seed",
            spaceId: params.spaceId,
            quantity: params.quantity,
            quantityUnit: params.quantityUnit,
            notes: params.notes,
            catalogId,
          })
          .returning();

        return {
          id: planting.id,
          crop: planting.crop,
          variety: planting.variety,
          stage: planting.stage,
          sourceType: planting.sourceType,
        };
      },
    }),

    updatePlanting: tool({
      description: "Update a planting's notes, quantity, or variety",
      parameters: z.object({
        plantingId: z.string().uuid(),
        variety: z.string().optional(),
        quantity: z.number().int().optional(),
        quantityUnit: z.string().optional(),
        notes: z.string().optional(),
      }),
      execute: async ({ plantingId, ...updates }) => {
        const [updated] = await db
          .update(plantings)
          .set({ ...updates, updatedAt: new Date() })
          .where(eq(plantings.id, plantingId))
          .returning();
        if (!updated) return { error: "Planting not found" };
        return {
          id: updated.id,
          crop: updated.crop,
          variety: updated.variety,
          quantity: updated.quantity,
          quantityUnit: updated.quantityUnit,
          notes: updated.notes,
        };
      },
    }),

    advanceStage: tool({
      description: `Advance a planting to a new growth stage. Valid progressions:
  Planned → SeededIndoors → Seedling → HardeningOff → Transplanted → Producing → Finished
  Planned → DirectSown → Producing → Finished
  Any → Failed
Stage transitions auto-set timestamps (started_at, hardened_at, transplanted_at).`,
      parameters: z.object({
        plantingId: z.string().uuid(),
        newStage: PlantingStage,
      }),
      execute: async ({ plantingId, newStage }) => {
        const [planting] = await db
          .select()
          .from(plantings)
          .where(eq(plantings.id, plantingId));
        if (!planting) return { error: "Planting not found" };

        const timestampUpdates: Record<string, Date> = {};
        const now = new Date();
        if (
          newStage === "seeded_indoors" ||
          newStage === "direct_sown"
        ) {
          timestampUpdates.startedAt = now;
        }
        if (newStage === "hardening_off") {
          timestampUpdates.hardenedAt = now;
        }
        if (newStage === "transplanted") {
          timestampUpdates.transplantedAt = now;
        }

        const [updated] = await db
          .update(plantings)
          .set({
            stage: newStage,
            ...timestampUpdates,
            updatedAt: now,
          })
          .where(eq(plantings.id, plantingId))
          .returning();

        // Log the stage change as an event
        await db.insert(events).values({
          seasonId: planting.seasonId,
          plantingId,
          type: "stage_change",
          summary: `${planting.crop}${planting.variety ? ` (${planting.variety})` : ""}: ${planting.stage} → ${newStage}`,
          dataJson: {
            previousStage: planting.stage,
            newStage,
          },
        });

        return {
          id: updated.id,
          crop: updated.crop,
          variety: updated.variety,
          stage: updated.stage,
          startedAt: updated.startedAt?.toISOString() ?? null,
          hardenedAt: updated.hardenedAt?.toISOString() ?? null,
          transplantedAt: updated.transplantedAt?.toISOString() ?? null,
        };
      },
    }),

    updateHealth: tool({
      description:
        "Update the health status of a planting. Always log the reason.",
      parameters: z.object({
        plantingId: z.string().uuid(),
        health: HealthStatus,
        reason: z.string().describe("Why the health changed"),
      }),
      execute: async ({ plantingId, health, reason }) => {
        const [planting] = await db
          .select()
          .from(plantings)
          .where(eq(plantings.id, plantingId));
        if (!planting) return { error: "Planting not found" };

        const [updated] = await db
          .update(plantings)
          .set({ health, updatedAt: new Date() })
          .where(eq(plantings.id, plantingId))
          .returning();

        await db.insert(events).values({
          seasonId: planting.seasonId,
          plantingId,
          type: "observation",
          summary: `Health update: ${planting.health} → ${health}. ${reason}`,
          dataJson: {
            previousHealth: planting.health,
            newHealth: health,
            reason,
          },
        });

        return {
          id: updated.id,
          crop: updated.crop,
          variety: updated.variety,
          health: updated.health,
        };
      },
    }),

    movePlanting: tool({
      description:
        "Move a planting to a different space. Warning: grid placements will be cleared.",
      parameters: z.object({
        plantingId: z.string().uuid(),
        newSpaceId: z.string().uuid(),
      }),
      execute: async ({ plantingId, newSpaceId }) => {
        const [planting] = await db
          .select()
          .from(plantings)
          .where(eq(plantings.id, plantingId));
        if (!planting) return { error: "Planting not found" };

        // Clear old grid placements if moving from an existing space
        if (planting.spaceId) {
          await db
            .delete(gridPlacements)
            .where(
              and(
                eq(gridPlacements.spaceId, planting.spaceId),
                eq(gridPlacements.plantingId, plantingId),
              ),
            );
        }

        const [updated] = await db
          .update(plantings)
          .set({ spaceId: newSpaceId, updatedAt: new Date() })
          .where(eq(plantings.id, plantingId))
          .returning();

        return {
          id: updated.id,
          crop: updated.crop,
          variety: updated.variety,
          newSpaceId,
          gridPlacementsCleared: !!planting.spaceId,
        };
      },
    }),

    deletePlanting: tool({
      description:
        "Delete a planting. Only call after user confirms. This removes all grid placements too.",
      parameters: z.object({
        plantingId: z.string().uuid(),
      }),
      execute: async ({ plantingId }) => {
        await db
          .delete(gridPlacements)
          .where(eq(gridPlacements.plantingId, plantingId));
        await db.delete(plantings).where(eq(plantings.id, plantingId));
        return { deleted: true, plantingId };
      },
    }),

    // ── Task Tools ───────────────────────────────────────────────────────

    listTasks: tool({
      description:
        "List tasks in a season, optionally filtered by status. Shows overdue tasks first.",
      parameters: z.object({
        seasonId: z.string().uuid(),
        status: z.enum(["pending", "completed", "skipped"]).optional(),
      }),
      execute: async ({ seasonId, status }) => {
        const rows = await db
          .select({
            id: tasks.id,
            title: tasks.title,
            type: tasks.type,
            status: tasks.status,
            priority: tasks.priority,
            dueAt: tasks.dueAt,
            notes: tasks.notes,
            plantingCrop: plantings.crop,
            plantingVariety: plantings.variety,
            spaceName: spaces.name,
          })
          .from(tasks)
          .leftJoin(plantings, eq(tasks.plantingId, plantings.id))
          .leftJoin(spaces, eq(tasks.spaceId, spaces.id))
          .where(
            status
              ? and(eq(tasks.seasonId, seasonId), eq(tasks.status, status))
              : eq(tasks.seasonId, seasonId),
          )
          .orderBy(asc(tasks.dueAt));

        return rows.map((r) => ({
          ...r,
          dueAt: r.dueAt?.toISOString() ?? null,
          isOverdue:
            r.status === "pending" && r.dueAt ? r.dueAt < new Date() : false,
        }));
      },
    }),

    createTask: tool({
      description:
        "Create a task/reminder. Types: seed_start, transplant, check, harvest, maintenance, other. Always set due_at.",
      parameters: z.object({
        seasonId: z.string().uuid(),
        title: z.string(),
        type: TaskType.optional(),
        priority: TaskPriority.optional(),
        dueAt: z.string().describe("ISO date when task is due"),
        plantingId: z.string().uuid().optional(),
        spaceId: z.string().uuid().optional(),
        notes: z.string().optional(),
      }),
      execute: async (params) => {
        if (!(await verifySeasonOwnership(userId, params.seasonId))) {
          return { error: "Season not found" };
        }
        const [task] = await db
          .insert(tasks)
          .values({
            ...params,
            type: params.type ?? "other",
            priority: params.priority ?? "medium",
            dueAt: new Date(params.dueAt),
          })
          .returning();
        return {
          id: task.id,
          title: task.title,
          type: task.type,
          priority: task.priority,
          dueAt: task.dueAt?.toISOString() ?? null,
        };
      },
    }),

    completeTask: tool({
      description: "Mark a task as completed",
      parameters: z.object({
        taskId: z.string().uuid(),
      }),
      execute: async ({ taskId }) => {
        const [updated] = await db
          .update(tasks)
          .set({
            status: "completed",
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(tasks.id, taskId))
          .returning();
        if (!updated) return { error: "Task not found" };
        return { id: updated.id, title: updated.title, status: "completed" };
      },
    }),

    skipTask: tool({
      description: "Skip/dismiss a task",
      parameters: z.object({
        taskId: z.string().uuid(),
      }),
      execute: async ({ taskId }) => {
        const [updated] = await db
          .update(tasks)
          .set({ status: "skipped", updatedAt: new Date() })
          .where(eq(tasks.id, taskId))
          .returning();
        if (!updated) return { error: "Task not found" };
        return { id: updated.id, title: updated.title, status: "skipped" };
      },
    }),

    updateTask: tool({
      description: "Update a task's title, due date, priority, or notes",
      parameters: z.object({
        taskId: z.string().uuid(),
        title: z.string().optional(),
        priority: TaskPriority.optional(),
        dueAt: z.string().optional().describe("New due date ISO string"),
        notes: z.string().optional(),
      }),
      execute: async ({ taskId, dueAt, ...updates }) => {
        const [updated] = await db
          .update(tasks)
          .set({
            ...updates,
            ...(dueAt ? { dueAt: new Date(dueAt) } : {}),
            updatedAt: new Date(),
          })
          .where(eq(tasks.id, taskId))
          .returning();
        if (!updated) return { error: "Task not found" };
        return {
          id: updated.id,
          title: updated.title,
          priority: updated.priority,
          dueAt: updated.dueAt?.toISOString() ?? null,
        };
      },
    }),

    deleteTask: tool({
      description: "Delete a task. Only call after user confirms.",
      parameters: z.object({
        taskId: z.string().uuid(),
      }),
      execute: async ({ taskId }) => {
        await db.delete(tasks).where(eq(tasks.id, taskId));
        return { deleted: true, taskId };
      },
    }),

    // ── Event Tools ──────────────────────────────────────────────────────

    listRecentEvents: tool({
      description:
        "List recent events/activity log for a season. Answers 'what happened recently?'",
      parameters: z.object({
        seasonId: z.string().uuid(),
        limit: z.number().int().optional().describe("Max events (default 20)"),
      }),
      execute: async ({ seasonId, limit }) => {
        const rows = await db
          .select({
            id: events.id,
            type: events.type,
            happenedAt: events.happenedAt,
            summary: events.summary,
            plantingCrop: plantings.crop,
            plantingVariety: plantings.variety,
            spaceName: spaces.name,
          })
          .from(events)
          .leftJoin(plantings, eq(events.plantingId, plantings.id))
          .leftJoin(spaces, eq(events.spaceId, spaces.id))
          .where(eq(events.seasonId, seasonId))
          .orderBy(desc(events.happenedAt))
          .limit(limit ?? 20);

        return rows.map((r) => ({
          ...r,
          happenedAt: r.happenedAt.toISOString(),
        }));
      },
    }),

    recordObservation: tool({
      description:
        "Record an observation, harvest, watering, or other event. For harvests, include quantity in data.",
      parameters: z.object({
        seasonId: z.string().uuid(),
        type: EventType,
        summary: z.string().describe("What happened"),
        plantingId: z.string().uuid().optional(),
        spaceId: z.string().uuid().optional(),
        data: z
          .record(z.unknown())
          .optional()
          .describe("Additional structured data (e.g. harvest quantity)"),
      }),
      execute: async (params) => {
        const [event] = await db
          .insert(events)
          .values({
            seasonId: params.seasonId,
            type: params.type,
            summary: params.summary,
            plantingId: params.plantingId,
            spaceId: params.spaceId,
            dataJson: params.data ?? null,
          })
          .returning();
        return {
          id: event.id,
          type: event.type,
          summary: event.summary,
          happenedAt: event.happenedAt.toISOString(),
        };
      },
    }),

    deleteEvent: tool({
      description: "Delete an event/log entry. Only call after user confirms.",
      parameters: z.object({
        eventId: z.string().uuid(),
      }),
      execute: async ({ eventId }) => {
        await db.delete(events).where(eq(events.id, eventId));
        return { deleted: true, eventId };
      },
    }),

    // ── Catalog Tools ────────────────────────────────────────────────────

    searchCatalog: tool({
      description:
        "Search the user's personal seed/start catalog by crop name",
      parameters: z.object({
        crop: z.string().describe("Crop name to search for"),
      }),
      execute: async ({ crop }) => {
        const rows = await db
          .select()
          .from(catalogEntries)
          .where(
            and(
              eq(catalogEntries.userId, userId),
              ilike(catalogEntries.crop, `%${crop}%`),
            ),
          );
        return rows.map((e) => ({
          id: e.id,
          crop: e.crop,
          variety: e.variety,
          vendor: e.vendor,
          sourceType: e.sourceType,
          daysToMaturity: e.daysToMaturity,
          startIndoorsWeeks: e.startIndoorsWeeks,
          spacingInches: e.spacingInches,
          plantsPerSquare: e.plantsPerSquare,
          sun: e.sun,
        }));
      },
    }),

    createCatalogEntry: tool({
      description:
        "Add a new variety to the user's seed catalog with growing data",
      parameters: z.object({
        crop: z.string(),
        variety: z.string().optional(),
        vendor: z.string().optional(),
        sourceType: SourceType.optional(),
        daysToMaturity: z.number().int().optional(),
        startIndoorsWeeks: z
          .number()
          .int()
          .optional()
          .describe("Weeks before last frost to start indoors"),
        minNightTemp: z
          .number()
          .int()
          .optional()
          .describe("Min night temp (°F) for transplant"),
        spacingInches: z.number().int().optional(),
        plantsPerSquare: z
          .number()
          .int()
          .optional()
          .describe("Plants per square foot"),
        sun: z
          .enum(["full_sun", "partial_sun", "partial_shade", "full_shade"])
          .optional(),
        growthHabit: z.string().optional(),
        notes: z.string().optional(),
      }),
      execute: async (params) => {
        const [entry] = await db
          .insert(catalogEntries)
          .values({ ...params, userId })
          .returning();
        return {
          id: entry.id,
          crop: entry.crop,
          variety: entry.variety,
          daysToMaturity: entry.daysToMaturity,
        };
      },
    }),

    getCatalogEntry: tool({
      description: "Get full details of a catalog entry including reviews",
      parameters: z.object({
        catalogId: z.string().uuid(),
      }),
      execute: async ({ catalogId }) => {
        const [entry] = await db
          .select()
          .from(catalogEntries)
          .where(
            and(
              eq(catalogEntries.id, catalogId),
              eq(catalogEntries.userId, userId),
            ),
          );
        if (!entry) return { error: "Catalog entry not found" };
        return {
          id: entry.id,
          crop: entry.crop,
          variety: entry.variety,
          vendor: entry.vendor,
          sourceType: entry.sourceType,
          daysToMaturity: entry.daysToMaturity,
          startIndoorsWeeks: entry.startIndoorsWeeks,
          minNightTemp: entry.minNightTemp,
          spacingInches: entry.spacingInches,
          plantsPerSquare: entry.plantsPerSquare,
          sun: entry.sun,
          growthHabit: entry.growthHabit,
          notes: entry.notes,
        };
      },
    }),

    updateCatalogEntry: tool({
      description: "Update a catalog entry's growing data, vendor, or notes",
      parameters: z.object({
        catalogId: z.string().uuid(),
        vendor: z.string().optional(),
        sourceType: SourceType.optional(),
        daysToMaturity: z.number().int().optional(),
        startIndoorsWeeks: z.number().int().optional(),
        minNightTemp: z.number().int().optional(),
        spacingInches: z.number().int().optional(),
        plantsPerSquare: z.number().int().optional(),
        sun: z
          .enum(["full_sun", "partial_sun", "partial_shade", "full_shade"])
          .optional(),
        growthHabit: z.string().optional(),
        notes: z.string().optional(),
      }),
      execute: async ({ catalogId, ...updates }) => {
        const [updated] = await db
          .update(catalogEntries)
          .set({ ...updates, updatedAt: new Date() })
          .where(
            and(
              eq(catalogEntries.id, catalogId),
              eq(catalogEntries.userId, userId),
            ),
          )
          .returning();
        if (!updated) return { error: "Catalog entry not found" };
        return {
          id: updated.id,
          crop: updated.crop,
          variety: updated.variety,
          daysToMaturity: updated.daysToMaturity,
          startIndoorsWeeks: updated.startIndoorsWeeks,
        };
      },
    }),

    deleteCatalogEntry: tool({
      description:
        "Delete a catalog entry. Only call after user confirms. Plantings linked to it will be unlinked.",
      parameters: z.object({
        catalogId: z.string().uuid(),
      }),
      execute: async ({ catalogId }) => {
        // Unlink plantings
        await db
          .update(plantings)
          .set({ catalogId: null, updatedAt: new Date() })
          .where(eq(plantings.catalogId, catalogId));
        await db
          .delete(catalogEntries)
          .where(
            and(
              eq(catalogEntries.id, catalogId),
              eq(catalogEntries.userId, userId),
            ),
          );
        return { deleted: true, catalogId };
      },
    }),

    // ── Catalog Reviews ─────────────────────────────────────────────────

    createCatalogReview: tool({
      description:
        "Add a review/rating for a catalog variety after growing it in a season",
      parameters: z.object({
        catalogId: z.string().uuid(),
        seasonId: z.string().uuid(),
        plantingId: z.string().uuid().optional(),
        rating: z
          .number()
          .int()
          .min(1)
          .max(5)
          .optional()
          .describe("1-5 star rating"),
        yieldNotes: z.string().optional(),
        wouldGrowAgain: z
          .number()
          .int()
          .min(0)
          .max(1)
          .optional()
          .describe("1 = yes, 0 = no"),
        review: z.string().optional(),
      }),
      execute: async (params) => {
        const [existing] = await db
          .select()
          .from(catalogReviews)
          .where(
            and(
              eq(catalogReviews.catalogId, params.catalogId),
              eq(catalogReviews.seasonId, params.seasonId),
            ),
          );
        if (existing) {
          const [updated] = await db
            .update(catalogReviews)
            .set({
              rating: params.rating ?? existing.rating,
              yieldNotes: params.yieldNotes ?? existing.yieldNotes,
              wouldGrowAgain: params.wouldGrowAgain ?? existing.wouldGrowAgain,
              review: params.review ?? existing.review,
              plantingId: params.plantingId ?? existing.plantingId,
            })
            .where(eq(catalogReviews.id, existing.id))
            .returning();
          return {
            id: updated.id,
            rating: updated.rating,
            review: updated.review,
            alreadyExisted: true,
          };
        }
        const [created] = await db
          .insert(catalogReviews)
          .values(params)
          .returning();
        return {
          id: created.id,
          rating: created.rating,
          review: created.review,
        };
      },
    }),

    listCatalogReviews: tool({
      description: "List reviews for a catalog entry across seasons",
      parameters: z.object({
        catalogId: z.string().uuid(),
      }),
      execute: async ({ catalogId }) => {
        const rows = await db
          .select({
            id: catalogReviews.id,
            seasonName: seasons.name,
            seasonYear: seasons.year,
            rating: catalogReviews.rating,
            yieldNotes: catalogReviews.yieldNotes,
            wouldGrowAgain: catalogReviews.wouldGrowAgain,
            review: catalogReviews.review,
            createdAt: catalogReviews.createdAt,
          })
          .from(catalogReviews)
          .innerJoin(seasons, eq(catalogReviews.seasonId, seasons.id))
          .where(eq(catalogReviews.catalogId, catalogId))
          .orderBy(desc(catalogReviews.createdAt));
        return rows.map((r) => ({
          ...r,
          createdAt: r.createdAt.toISOString(),
        }));
      },
    }),

    deleteCatalogReview: tool({
      description: "Delete a catalog review",
      parameters: z.object({
        reviewId: z.string().uuid(),
      }),
      execute: async ({ reviewId }) => {
        await db.delete(catalogReviews).where(eq(catalogReviews.id, reviewId));
        return { deleted: true, reviewId };
      },
    }),

    // ── Planning Tools ───────────────────────────────────────────────────

    getWeekPlan: tool({
      description:
        "Get a prioritized weekly plan: overdue tasks, upcoming tasks, and what to do next. THE go-to tool for 'what should I do?' questions.",
      parameters: z.object({
        seasonId: z.string().uuid(),
      }),
      execute: async ({ seasonId }) => {
        const now = new Date();
        const oneWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        const overdueTasks = await db
          .select({
            id: tasks.id,
            title: tasks.title,
            type: tasks.type,
            priority: tasks.priority,
            dueAt: tasks.dueAt,
            plantingCrop: plantings.crop,
            plantingVariety: plantings.variety,
          })
          .from(tasks)
          .leftJoin(plantings, eq(tasks.plantingId, plantings.id))
          .where(
            and(
              eq(tasks.seasonId, seasonId),
              eq(tasks.status, "pending"),
              lte(tasks.dueAt, now),
            ),
          )
          .orderBy(asc(tasks.dueAt));

        const upcomingTasks = await db
          .select({
            id: tasks.id,
            title: tasks.title,
            type: tasks.type,
            priority: tasks.priority,
            dueAt: tasks.dueAt,
            plantingCrop: plantings.crop,
            plantingVariety: plantings.variety,
          })
          .from(tasks)
          .leftJoin(plantings, eq(tasks.plantingId, plantings.id))
          .where(
            and(
              eq(tasks.seasonId, seasonId),
              eq(tasks.status, "pending"),
              gt(tasks.dueAt, now),
              lte(tasks.dueAt, oneWeek),
            ),
          )
          .orderBy(asc(tasks.dueAt));

        const activePlantings = await db
          .select({
            id: plantings.id,
            crop: plantings.crop,
            variety: plantings.variety,
            stage: plantings.stage,
            health: plantings.health,
            startedAt: plantings.startedAt,
          })
          .from(plantings)
          .where(
            and(
              eq(plantings.seasonId, seasonId),
              notInArray(plantings.stage, ["finished", "failed"]),
            ),
          );

        return {
          overdueTasks: overdueTasks.map((t) => ({
            ...t,
            dueAt: t.dueAt?.toISOString() ?? null,
          })),
          upcomingTasks: upcomingTasks.map((t) => ({
            ...t,
            dueAt: t.dueAt?.toISOString() ?? null,
          })),
          activePlantings: activePlantings.map((p) => ({
            ...p,
            startedAt: p.startedAt?.toISOString() ?? null,
          })),
        };
      },
    }),

    // ── Planning Tools ───────────────────────────────────────────────────

    getPlantingSchedule: tool({
      description: `Compute a planting schedule for a season based on frost dates and catalog data.
For each planting that has catalog data, calculates:
- When to start seeds indoors (startIndoorsWeeks before last frost)
- When to harden off (2 weeks before transplant)
- When to transplant (after last frost + minNightTemp safety)
- Estimated harvest date (transplant + daysToMaturity)
Only works if the season has a lastFrostDate set and plantings are linked to catalog entries with growing data.`,
      parameters: z.object({
        seasonId: z.string().uuid(),
      }),
      execute: async ({ seasonId }) => {
        const [season] = await db
          .select()
          .from(seasons)
          .where(eq(seasons.id, seasonId));
        if (!season) return { error: "Season not found" };
        if (!season.lastFrostDate) {
          return {
            error:
              "No last frost date set for this season. Set it first so I can compute planting dates.",
          };
        }

        const lastFrost = season.lastFrostDate;

        const plantingRows = await db
          .select({
            id: plantings.id,
            crop: plantings.crop,
            variety: plantings.variety,
            stage: plantings.stage,
            sourceType: plantings.sourceType,
            spaceName: spaces.name,
            catalogId: plantings.catalogId,
            startIndoorsWeeks: catalogEntries.startIndoorsWeeks,
            daysToMaturity: catalogEntries.daysToMaturity,
            minNightTemp: catalogEntries.minNightTemp,
          })
          .from(plantings)
          .leftJoin(spaces, eq(plantings.spaceId, spaces.id))
          .leftJoin(catalogEntries, eq(plantings.catalogId, catalogEntries.id))
          .where(
            and(
              eq(plantings.seasonId, seasonId),
              notInArray(plantings.stage, ["finished", "failed"]),
            ),
          )
          .orderBy(asc(plantings.crop));

        const schedule = plantingRows.map((p) => {
          const dates: Record<string, string | null> = {
            startIndoors: null,
            hardenOff: null,
            transplant: null,
            estimatedHarvest: null,
          };

          if (p.startIndoorsWeeks) {
            const startDate = new Date(lastFrost);
            startDate.setDate(startDate.getDate() - p.startIndoorsWeeks * 7);
            dates.startIndoors = startDate.toISOString().split("T")[0];
          }

          // Transplant: last frost date (or later if minNightTemp is high)
          const transplantDate = new Date(lastFrost);
          if (p.minNightTemp && p.minNightTemp > 32) {
            // Add extra days for warm-season crops (rough: 1 week per 5°F above 32)
            const extraDays = Math.ceil(((p.minNightTemp - 32) / 5) * 7);
            transplantDate.setDate(transplantDate.getDate() + extraDays);
          }
          dates.transplant = transplantDate.toISOString().split("T")[0];

          // Harden off: 2 weeks before transplant
          const hardenDate = new Date(transplantDate);
          hardenDate.setDate(hardenDate.getDate() - 14);
          dates.hardenOff = hardenDate.toISOString().split("T")[0];

          // Estimated harvest
          if (p.daysToMaturity) {
            const harvestDate = new Date(transplantDate);
            harvestDate.setDate(
              harvestDate.getDate() + p.daysToMaturity,
            );
            dates.estimatedHarvest = harvestDate.toISOString().split("T")[0];
          }

          return {
            id: p.id,
            crop: p.crop,
            variety: p.variety,
            stage: p.stage,
            sourceType: p.sourceType,
            spaceName: p.spaceName,
            hasCatalogData: !!p.catalogId,
            dates,
          };
        });

        return {
          lastFrostDate: lastFrost.toISOString().split("T")[0],
          firstFrostDate: season.firstFrostDate
            ? season.firstFrostDate.toISOString().split("T")[0]
            : null,
          schedule,
        };
      },
    }),

    generateAutoTasks: tool({
      description: `Generate tasks from the planting schedule. Creates seed start, harden off, and transplant tasks
based on catalog data and frost dates. Idempotent — skips tasks that already exist for a planting+type combo.
Only generates tasks for plantings that have catalog data with timing info.`,
      parameters: z.object({
        seasonId: z.string().uuid(),
      }),
      execute: async ({ seasonId }) => {
        const [season] = await db
          .select()
          .from(seasons)
          .where(eq(seasons.id, seasonId));
        if (!season) return { error: "Season not found" };
        if (!season.lastFrostDate) {
          return { error: "No last frost date set for this season." };
        }

        const lastFrost = season.lastFrostDate;

        const plantingRows = await db
          .select({
            id: plantings.id,
            crop: plantings.crop,
            variety: plantings.variety,
            stage: plantings.stage,
            sourceType: plantings.sourceType,
            startIndoorsWeeks: catalogEntries.startIndoorsWeeks,
            daysToMaturity: catalogEntries.daysToMaturity,
            minNightTemp: catalogEntries.minNightTemp,
          })
          .from(plantings)
          .leftJoin(catalogEntries, eq(plantings.catalogId, catalogEntries.id))
          .where(
            and(
              eq(plantings.seasonId, seasonId),
              notInArray(plantings.stage, ["finished", "failed"]),
            ),
          );

        // Get existing tasks to avoid duplicates
        const existingTasks = await db
          .select({
            plantingId: tasks.plantingId,
            type: tasks.type,
          })
          .from(tasks)
          .where(eq(tasks.seasonId, seasonId));

        const existingSet = new Set(
          existingTasks.map((t) => `${t.plantingId}:${t.type}`),
        );

        const newTasks: Array<{
          seasonId: string;
          plantingId: string;
          title: string;
          type: string;
          priority: string;
          dueAt: Date;
        }> = [];

        for (const p of plantingRows) {
          const label = p.variety ? `${p.crop} (${p.variety})` : p.crop;

          // Seed start task
          if (
            p.startIndoorsWeeks &&
            p.sourceType === "seed" &&
            !existingSet.has(`${p.id}:seed_start`)
          ) {
            const startDate = new Date(lastFrost);
            startDate.setDate(startDate.getDate() - p.startIndoorsWeeks * 7);
            newTasks.push({
              seasonId,
              plantingId: p.id,
              title: `Start ${label} seeds indoors`,
              type: "seed_start",
              priority: "high",
              dueAt: startDate,
            });
          }

          // Transplant task
          if (!existingSet.has(`${p.id}:transplant`)) {
            const transplantDate = new Date(lastFrost);
            if (p.minNightTemp && p.minNightTemp > 32) {
              const extraDays = Math.ceil(((p.minNightTemp - 32) / 5) * 7);
              transplantDate.setDate(transplantDate.getDate() + extraDays);
            }
            newTasks.push({
              seasonId,
              plantingId: p.id,
              title: `Transplant ${label} outdoors`,
              type: "transplant",
              priority: "high",
              dueAt: transplantDate,
            });
          }
        }

        if (newTasks.length > 0) {
          await db.insert(tasks).values(newTasks);
        }

        return {
          created: newTasks.length,
          tasks: newTasks.map((t) => ({
            title: t.title,
            type: t.type,
            dueAt: t.dueAt.toISOString().split("T")[0],
          })),
        };
      },
    }),
  };
}

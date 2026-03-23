import { eq, and, asc } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  spaces,
  plantings,
  gridPlacements,
} from "../db/schema.js";
import { verifySeasonOwnership } from "./auth-checks.js";
import type { SpaceType } from "@tendy/shared";

// ── Types ───────────────────────────────────────────────────────────────────

export interface CreateSpaceParams {
  seasonId: string;
  name: string;
  type: SpaceType;
  width?: number;
  length?: number;
  unit?: "ft" | "in" | "m";
  sunExposure?: "full_sun" | "partial_sun" | "partial_shade" | "full_shade";
  posX?: number;
  posY?: number;
  notes?: string;
}

export interface UpdateSpaceParams {
  name?: string;
  type?: SpaceType;
  width?: number;
  length?: number;
  posX?: number;
  posY?: number;
  sunExposure?: "full_sun" | "partial_sun" | "partial_shade" | "full_shade";
  notes?: string;
}

export interface GridCell {
  row: number;
  col: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

async function verifySpaceOwnership(
  userId: string,
  spaceId: string,
): Promise<boolean> {
  const [space] = await db
    .select({ seasonId: spaces.seasonId })
    .from(spaces)
    .where(eq(spaces.id, spaceId));
  if (!space) return false;
  return verifySeasonOwnership(userId, space.seasonId);
}

// ── Service Functions ───────────────────────────────────────────────────────

export async function list(userId: string, seasonId: string) {
  if (!(await verifySeasonOwnership(userId, seasonId))) {
    return { error: "Season not found" as const };
  }
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
    posX: s.posX,
    posY: s.posY,
    sunExposure: s.sunExposure,
  }));
}

export async function get(userId: string, spaceId: string) {
  if (!(await verifySpaceOwnership(userId, spaceId))) {
    return { error: "Space not found" as const };
  }
  const [space] = await db
    .select()
    .from(spaces)
    .where(eq(spaces.id, spaceId));
  if (!space) return { error: "Space not found" as const };
  return {
    id: space.id,
    name: space.name,
    type: space.type,
    width: space.width,
    length: space.length,
    posX: space.posX,
    posY: space.posY,
    sunExposure: space.sunExposure,
    notes: space.notes,
  };
}

export async function create(userId: string, params: CreateSpaceParams) {
  if (!(await verifySeasonOwnership(userId, params.seasonId))) {
    return { error: "Season not found" as const };
  }
  // Check for existing space with same name (upsert pattern)
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
      posX: existing.posX,
      posY: existing.posY,
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
    posX: space.posX,
    posY: space.posY,
  };
}

export async function update(
  userId: string,
  spaceId: string,
  params: UpdateSpaceParams,
) {
  if (!(await verifySpaceOwnership(userId, spaceId))) {
    return { error: "Space not found" as const };
  }
  const [updated] = await db
    .update(spaces)
    .set({ ...params, updatedAt: new Date() })
    .where(eq(spaces.id, spaceId))
    .returning();
  if (!updated) return { error: "Space not found" as const };
  return {
    id: updated.id,
    name: updated.name,
    type: updated.type,
    width: updated.width,
    length: updated.length,
    sunExposure: updated.sunExposure,
  };
}

export async function del(userId: string, spaceId: string) {
  if (!(await verifySpaceOwnership(userId, spaceId))) {
    return { error: "Space not found" as const };
  }
  await db
    .delete(gridPlacements)
    .where(eq(gridPlacements.spaceId, spaceId));
  // Unlink plantings from this space
  await db
    .update(plantings)
    .set({ spaceId: null, updatedAt: new Date() })
    .where(eq(plantings.spaceId, spaceId));
  await db.delete(spaces).where(eq(spaces.id, spaceId));
  return { deleted: true, spaceId };
}

export async function getGrid(userId: string, spaceId: string) {
  if (!(await verifySpaceOwnership(userId, spaceId))) {
    return { error: "Space not found" as const };
  }
  const [space] = await db
    .select()
    .from(spaces)
    .where(eq(spaces.id, spaceId));
  if (!space) return { error: "Space not found" as const };

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
}

export async function placeOnGrid(
  userId: string,
  params: { spaceId: string; plantingId: string; cells: GridCell[] },
) {
  if (!(await verifySpaceOwnership(userId, params.spaceId))) {
    return { error: "Space not found" as const };
  }
  const values = params.cells.map((c) => ({
    spaceId: params.spaceId,
    plantingId: params.plantingId,
    row: c.row,
    col: c.col,
  }));
  await db.insert(gridPlacements).values(values);
  return {
    placed: params.cells.length,
    spaceId: params.spaceId,
    plantingId: params.plantingId,
  };
}

export async function removeFromGrid(
  userId: string,
  params: { spaceId: string; plantingId: string },
) {
  if (!(await verifySpaceOwnership(userId, params.spaceId))) {
    return { error: "Space not found" as const };
  }
  await db
    .delete(gridPlacements)
    .where(
      and(
        eq(gridPlacements.spaceId, params.spaceId),
        eq(gridPlacements.plantingId, params.plantingId),
      ),
    );
  return {
    removed: true,
    spaceId: params.spaceId,
    plantingId: params.plantingId,
  };
}

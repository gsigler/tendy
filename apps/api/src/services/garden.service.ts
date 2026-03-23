import { eq, and, desc } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  gardens,
  seasons,
  spaces,
  plantings,
  tasks,
  events,
  gridPlacements,
} from "../db/schema.js";
import { verifyGardenOwnership } from "./auth-checks.js";

// ── Types ───────────────────────────────────────────────────────────────────

export interface CreateGardenParams {
  name: string;
  location?: string;
  hardinessZone?: string;
  latitude?: number;
  longitude?: number;
}

export interface UpdateGardenParams {
  name?: string;
  location?: string;
  hardinessZone?: string;
  latitude?: number;
  longitude?: number;
}

// ── Service Functions ───────────────────────────────────────────────────────

export async function list(userId: string) {
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
}

export async function get(userId: string, gardenId: string) {
  if (!(await verifyGardenOwnership(userId, gardenId))) {
    return { error: "Garden not found" as const };
  }
  const [garden] = await db
    .select()
    .from(gardens)
    .where(and(eq(gardens.id, gardenId), eq(gardens.userId, userId)));
  if (!garden) return { error: "Garden not found" as const };
  return {
    id: garden.id,
    name: garden.name,
    location: garden.location,
    hardinessZone: garden.hardinessZone,
    latitude: garden.latitude,
    longitude: garden.longitude,
  };
}

export async function create(userId: string, params: CreateGardenParams) {
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
}

export async function update(
  userId: string,
  gardenId: string,
  params: UpdateGardenParams,
) {
  const [updated] = await db
    .update(gardens)
    .set({ ...params, updatedAt: new Date() })
    .where(and(eq(gardens.id, gardenId), eq(gardens.userId, userId)))
    .returning();
  if (!updated) return { error: "Garden not found" as const };
  return {
    id: updated.id,
    name: updated.name,
    location: updated.location,
    hardinessZone: updated.hardinessZone,
  };
}

export async function del(userId: string, gardenId: string) {
  const [garden] = await db
    .select()
    .from(gardens)
    .where(and(eq(gardens.id, gardenId), eq(gardens.userId, userId)));
  if (!garden) return { error: "Garden not found" as const };

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
      await db
        .delete(gridPlacements)
        .where(eq(gridPlacements.plantingId, p.id));
    }
    await db.delete(events).where(eq(events.seasonId, s.id));
    await db.delete(tasks).where(eq(tasks.seasonId, s.id));
    await db.delete(plantings).where(eq(plantings.seasonId, s.id));
    await db.delete(spaces).where(eq(spaces.seasonId, s.id));
  }
  await db.delete(seasons).where(eq(seasons.gardenId, gardenId));
  await db.delete(gardens).where(eq(gardens.id, gardenId));
  return { deleted: true, gardenId };
}

import { eq, and, desc } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  gardens,
  seasons,
  spaces,
  plantings,
  tasks,
} from "../db/schema.js";
import { verifySeasonOwnership, verifyGardenOwnership } from "./auth-checks.js";

// ── Types ───────────────────────────────────────────────────────────────────

export interface CreateSeasonParams {
  gardenId: string;
  year: number;
  name: string;
  lastFrostDate?: string;
  firstFrostDate?: string;
}

export interface UpdateSeasonParams {
  lastFrostDate?: string;
  firstFrostDate?: string;
  status?: "planning" | "active" | "complete";
}

// ── Service Functions ───────────────────────────────────────────────────────

export async function list(userId: string, gardenId: string) {
  if (!(await verifyGardenOwnership(userId, gardenId))) {
    return { error: "Garden not found" as const };
  }
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
}

export async function get(userId: string, seasonId: string) {
  if (!(await verifySeasonOwnership(userId, seasonId))) {
    return { error: "Season not found" as const };
  }
  const [season] = await db
    .select()
    .from(seasons)
    .where(eq(seasons.id, seasonId));
  if (!season) return { error: "Season not found" as const };
  return {
    id: season.id,
    year: season.year,
    name: season.name,
    status: season.status,
    lastFrostDate: season.lastFrostDate?.toISOString() ?? null,
    firstFrostDate: season.firstFrostDate?.toISOString() ?? null,
  };
}

export async function create(userId: string, params: CreateSeasonParams) {
  const { gardenId, year, name, lastFrostDate, firstFrostDate } = params;

  // Verify garden belongs to user
  const [garden] = await db
    .select()
    .from(gardens)
    .where(and(eq(gardens.id, gardenId), eq(gardens.userId, userId)));
  if (!garden) return { error: "Garden not found" as const };

  // Check for existing season with same name+year (upsert pattern)
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
          ...(lastFrostDate
            ? { lastFrostDate: new Date(lastFrostDate) }
            : {}),
          ...(firstFrostDate
            ? { firstFrostDate: new Date(firstFrostDate) }
            : {}),
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
}

export async function update(
  userId: string,
  seasonId: string,
  params: UpdateSeasonParams,
) {
  if (!(await verifySeasonOwnership(userId, seasonId))) {
    return { error: "Season not found" as const };
  }
  const { lastFrostDate, firstFrostDate, status } = params;
  const [updated] = await db
    .update(seasons)
    .set({
      ...(lastFrostDate ? { lastFrostDate: new Date(lastFrostDate) } : {}),
      ...(firstFrostDate
        ? { firstFrostDate: new Date(firstFrostDate) }
        : {}),
      ...(status ? { status } : {}),
      updatedAt: new Date(),
    })
    .where(eq(seasons.id, seasonId))
    .returning();
  if (!updated) return { error: "Season not found" as const };
  return {
    id: updated.id,
    name: updated.name,
    status: updated.status,
    lastFrostDate: updated.lastFrostDate?.toISOString() ?? null,
    firstFrostDate: updated.firstFrostDate?.toISOString() ?? null,
  };
}

export async function del(userId: string, seasonId: string) {
  if (!(await verifySeasonOwnership(userId, seasonId))) {
    return { error: "Season not found" as const };
  }
  // DB cascades: spaces/plantings/tasks/events/harvests/gridPlacements
  await db.delete(seasons).where(eq(seasons.id, seasonId));
  return { deleted: true, seasonId };
}

export async function getSummary(userId: string, seasonId: string) {
  if (!(await verifySeasonOwnership(userId, seasonId))) {
    return { error: "Season not found" as const };
  }
  const [season] = await db
    .select()
    .from(seasons)
    .where(eq(seasons.id, seasonId));
  if (!season) return { error: "Season not found" as const };

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
}

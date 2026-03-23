import { eq, and, asc, lte, gt, notInArray } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  seasons,
  plantings,
  tasks,
  spaces,
  catalogEntries,
} from "../db/schema.js";
import { verifySeasonOwnership } from "./auth-checks.js";

// ── Service Functions ───────────────────────────────────────────────────────

export async function getWeekPlan(userId: string, seasonId: string) {
  if (!(await verifySeasonOwnership(userId, seasonId))) {
    return { error: "Season not found" as const };
  }
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
}

export async function getPlantingSchedule(userId: string, seasonId: string) {
  if (!(await verifySeasonOwnership(userId, seasonId))) {
    return { error: "Season not found" as const };
  }
  const [season] = await db
    .select()
    .from(seasons)
    .where(eq(seasons.id, seasonId));
  if (!season) return { error: "Season not found" as const };
  if (!season.lastFrostDate) {
    return {
      error:
        "No last frost date set for this season. Set it first so I can compute planting dates." as const,
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
      dates.startIndoors = startDate.toISOString().split("T")[0]!;
    }

    // Transplant: last frost date (or later if minNightTemp is high)
    const transplantDate = new Date(lastFrost);
    if (p.minNightTemp && p.minNightTemp > 32) {
      // Add extra days for warm-season crops (rough: 1 week per 5 deg F above 32)
      const extraDays = Math.ceil(((p.minNightTemp - 32) / 5) * 7);
      transplantDate.setDate(transplantDate.getDate() + extraDays);
    }
    dates.transplant = transplantDate.toISOString().split("T")[0]!;

    // Harden off: 2 weeks before transplant
    const hardenDate = new Date(transplantDate);
    hardenDate.setDate(hardenDate.getDate() - 14);
    dates.hardenOff = hardenDate.toISOString().split("T")[0]!;

    // Estimated harvest
    if (p.daysToMaturity) {
      const harvestDate = new Date(transplantDate);
      harvestDate.setDate(harvestDate.getDate() + p.daysToMaturity);
      dates.estimatedHarvest = harvestDate.toISOString().split("T")[0]!;
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
    lastFrostDate: lastFrost.toISOString().split("T")[0]!,
    firstFrostDate: season.firstFrostDate
      ? season.firstFrostDate.toISOString().split("T")[0]!
      : null,
    schedule,
  };
}

export async function generateAutoTasks(userId: string, seasonId: string) {
  if (!(await verifySeasonOwnership(userId, seasonId))) {
    return { error: "Season not found" as const };
  }
  const [season] = await db
    .select()
    .from(seasons)
    .where(eq(seasons.id, seasonId));
  if (!season) return { error: "Season not found" as const };
  if (!season.lastFrostDate) {
    return { error: "No last frost date set for this season." as const };
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
}

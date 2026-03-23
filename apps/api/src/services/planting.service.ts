import { eq, and, asc } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  plantings,
  spaces,
  catalogEntries,
  events,
  gridPlacements,
} from "../db/schema.js";
import { verifySeasonOwnership } from "./auth-checks.js";
import type { PlantingStage, HealthStatus, SourceType } from "@tendy/shared";

// ── Types ───────────────────────────────────────────────────────────────────

export interface CreatePlantingParams {
  seasonId: string;
  crop: string;
  variety?: string;
  sourceType?: SourceType;
  spaceId?: string;
  quantity?: number;
  quantityUnit?: string;
  notes?: string;
}

export interface UpdatePlantingParams {
  variety?: string;
  quantity?: number;
  quantityUnit?: string;
  notes?: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

async function verifyPlantingOwnership(
  userId: string,
  plantingId: string,
): Promise<boolean> {
  const [planting] = await db
    .select({ seasonId: plantings.seasonId })
    .from(plantings)
    .where(eq(plantings.id, plantingId));
  if (!planting) return false;
  return verifySeasonOwnership(userId, planting.seasonId);
}

// ── Service Functions ───────────────────────────────────────────────────────

export async function list(userId: string, seasonId: string, stage?: PlantingStage) {
  if (!(await verifySeasonOwnership(userId, seasonId))) {
    return { error: "Season not found" as const };
  }
  const rows = await db
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

  return rows.map((r) => ({
    ...r,
    startedAt: r.startedAt?.toISOString() ?? null,
  }));
}

export async function get(userId: string, plantingId: string) {
  if (!(await verifyPlantingOwnership(userId, plantingId))) {
    return { error: "Planting not found" as const };
  }
  const [row] = await db
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
    .where(eq(plantings.id, plantingId));
  if (!row) return { error: "Planting not found" as const };
  return {
    ...row,
    startedAt: row.startedAt?.toISOString() ?? null,
  };
}

export async function create(userId: string, params: CreatePlantingParams) {
  if (!(await verifySeasonOwnership(userId, params.seasonId))) {
    return { error: "Season not found" as const };
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
}

export async function update(
  userId: string,
  plantingId: string,
  params: UpdatePlantingParams,
) {
  if (!(await verifyPlantingOwnership(userId, plantingId))) {
    return { error: "Planting not found" as const };
  }
  const [updated] = await db
    .update(plantings)
    .set({ ...params, updatedAt: new Date() })
    .where(eq(plantings.id, plantingId))
    .returning();
  if (!updated) return { error: "Planting not found" as const };
  return {
    id: updated.id,
    crop: updated.crop,
    variety: updated.variety,
    quantity: updated.quantity,
    quantityUnit: updated.quantityUnit,
    notes: updated.notes,
  };
}

export async function advanceStage(
  userId: string,
  plantingId: string,
  newStage: PlantingStage,
) {
  if (!(await verifyPlantingOwnership(userId, plantingId))) {
    return { error: "Planting not found" as const };
  }
  const [planting] = await db
    .select()
    .from(plantings)
    .where(eq(plantings.id, plantingId));
  if (!planting) return { error: "Planting not found" as const };

  const timestampUpdates: Record<string, Date> = {};
  const now = new Date();
  if (newStage === "seeded_indoors" || newStage === "direct_sown") {
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
}

export async function updateHealth(
  userId: string,
  plantingId: string,
  health: HealthStatus,
  reason?: string,
) {
  if (!(await verifyPlantingOwnership(userId, plantingId))) {
    return { error: "Planting not found" as const };
  }
  const [planting] = await db
    .select()
    .from(plantings)
    .where(eq(plantings.id, plantingId));
  if (!planting) return { error: "Planting not found" as const };

  const [updated] = await db
    .update(plantings)
    .set({ health, updatedAt: new Date() })
    .where(eq(plantings.id, plantingId))
    .returning();

  await db.insert(events).values({
    seasonId: planting.seasonId,
    plantingId,
    type: "observation",
    summary: `Health update: ${planting.health} → ${health}. ${reason ?? ""}`,
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
}

export async function move(
  userId: string,
  plantingId: string,
  newSpaceId: string,
) {
  if (!(await verifyPlantingOwnership(userId, plantingId))) {
    return { error: "Planting not found" as const };
  }
  const [planting] = await db
    .select()
    .from(plantings)
    .where(eq(plantings.id, plantingId));
  if (!planting) return { error: "Planting not found" as const };

  // Verify destination space is also owned by user
  const [destSpace] = await db
    .select({ seasonId: spaces.seasonId })
    .from(spaces)
    .where(eq(spaces.id, newSpaceId));
  if (!destSpace) return { error: "Destination space not found" as const };
  if (!(await verifySeasonOwnership(userId, destSpace.seasonId))) {
    return { error: "Destination space not found" as const };
  }

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
}

export async function del(userId: string, plantingId: string) {
  if (!(await verifyPlantingOwnership(userId, plantingId))) {
    return { error: "Planting not found" as const };
  }
  await db
    .delete(gridPlacements)
    .where(eq(gridPlacements.plantingId, plantingId));
  await db.delete(plantings).where(eq(plantings.id, plantingId));
  return { deleted: true, plantingId };
}

import { eq, desc, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { harvests, plantings } from "../db/schema.js";
import { verifySeasonOwnership } from "./auth-checks.js";

interface CreateHarvestParams {
  seasonId: string;
  plantingId?: string;
  spaceId?: string;
  crop: string;
  variety?: string;
  quantity?: number;
  quantityUnit?: string;
  weightOz?: number;
  harvestedAt?: string;
  quality?: string;
  notes?: string;
}

interface UpdateHarvestParams {
  quantity?: number;
  quantityUnit?: string;
  weightOz?: number;
  harvestedAt?: string;
  quality?: string;
  notes?: string;
}

async function verifyHarvestOwnership(userId: string, harvestId: string) {
  const [harvest] = await db
    .select({ seasonId: harvests.seasonId })
    .from(harvests)
    .where(eq(harvests.id, harvestId))
    .limit(1);
  if (!harvest) return false;
  return verifySeasonOwnership(userId, harvest.seasonId);
}

export async function list(userId: string, seasonId: string) {
  if (!(await verifySeasonOwnership(userId, seasonId))) {
    return { error: "Season not found" as const };
  }
  return db
    .select({
      id: harvests.id,
      crop: harvests.crop,
      variety: harvests.variety,
      quantity: harvests.quantity,
      quantityUnit: harvests.quantityUnit,
      weightOz: harvests.weightOz,
      harvestedAt: harvests.harvestedAt,
      quality: harvests.quality,
      notes: harvests.notes,
      plantingId: harvests.plantingId,
      spaceId: harvests.spaceId,
      createdAt: harvests.createdAt,
    })
    .from(harvests)
    .where(eq(harvests.seasonId, seasonId))
    .orderBy(desc(harvests.harvestedAt));
}

export async function get(userId: string, harvestId: string) {
  if (!(await verifyHarvestOwnership(userId, harvestId))) {
    return { error: "Harvest not found" as const };
  }
  const [harvest] = await db
    .select()
    .from(harvests)
    .where(eq(harvests.id, harvestId))
    .limit(1);
  return harvest ?? null;
}

export async function create(userId: string, params: CreateHarvestParams) {
  if (!(await verifySeasonOwnership(userId, params.seasonId))) {
    return { error: "Season not found" as const };
  }

  // If plantingId provided, auto-fill crop/variety from planting
  let crop = params.crop;
  let variety = params.variety;
  if (params.plantingId) {
    const [planting] = await db
      .select({ crop: plantings.crop, variety: plantings.variety })
      .from(plantings)
      .where(eq(plantings.id, params.plantingId))
      .limit(1);
    if (planting) {
      crop = crop || planting.crop;
      variety = variety ?? planting.variety ?? undefined;
    }
  }

  const [harvest] = await db
    .insert(harvests)
    .values({
      seasonId: params.seasonId,
      plantingId: params.plantingId,
      spaceId: params.spaceId,
      crop,
      variety,
      quantity: params.quantity,
      quantityUnit: params.quantityUnit,
      weightOz: params.weightOz,
      harvestedAt: params.harvestedAt ? new Date(params.harvestedAt) : new Date(),
      quality: params.quality,
      notes: params.notes,
    })
    .returning();

  return harvest;
}

export async function update(
  userId: string,
  harvestId: string,
  params: UpdateHarvestParams,
) {
  if (!(await verifyHarvestOwnership(userId, harvestId))) {
    return { error: "Harvest not found" as const };
  }

  const updates: Record<string, unknown> = {};
  if (params.quantity !== undefined) updates.quantity = params.quantity;
  if (params.quantityUnit !== undefined) updates.quantityUnit = params.quantityUnit;
  if (params.weightOz !== undefined) updates.weightOz = params.weightOz;
  if (params.harvestedAt !== undefined) updates.harvestedAt = new Date(params.harvestedAt);
  if (params.quality !== undefined) updates.quality = params.quality;
  if (params.notes !== undefined) updates.notes = params.notes;

  if (Object.keys(updates).length === 0) {
    return get(userId, harvestId);
  }

  const [harvest] = await db
    .update(harvests)
    .set(updates)
    .where(eq(harvests.id, harvestId))
    .returning();

  return harvest ?? null;
}

export async function del(userId: string, harvestId: string) {
  if (!(await verifyHarvestOwnership(userId, harvestId))) {
    return { error: "Harvest not found" as const };
  }
  await db.delete(harvests).where(eq(harvests.id, harvestId));
}

export async function summary(userId: string, seasonId: string) {
  if (!(await verifySeasonOwnership(userId, seasonId))) {
    return { error: "Season not found" as const };
  }

  const rows = await db
    .select({
      crop: harvests.crop,
      variety: harvests.variety,
      totalQuantity: sql<number>`coalesce(sum(${harvests.quantity}), 0)`,
      totalWeightOz: sql<number>`coalesce(sum(${harvests.weightOz}), 0)`,
      harvestCount: sql<number>`count(*)`,
      firstHarvest: sql<string>`min(${harvests.harvestedAt})`,
      lastHarvest: sql<string>`max(${harvests.harvestedAt})`,
    })
    .from(harvests)
    .where(eq(harvests.seasonId, seasonId))
    .groupBy(harvests.crop, harvests.variety)
    .orderBy(desc(sql`count(*)`));

  return rows;
}

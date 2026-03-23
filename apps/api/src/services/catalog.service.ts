import { eq, and, ilike } from "drizzle-orm";
import { db } from "../db/index.js";
import { catalogEntries, plantings } from "../db/schema.js";
import type { SourceType } from "@tendy/shared";

// ── Types ───────────────────────────────────────────────────────────────────

export interface CreateCatalogParams {
  crop: string;
  variety?: string;
  vendor?: string;
  sourceType?: SourceType;
  daysToMaturity?: number;
  startIndoorsWeeks?: number;
  minNightTemp?: number;
  spacingInches?: number;
  plantsPerSquare?: number;
  sun?: "full_sun" | "partial_sun" | "partial_shade" | "full_shade";
  growthHabit?: string;
  notes?: string;
}

export interface UpdateCatalogParams {
  vendor?: string;
  sourceType?: SourceType;
  daysToMaturity?: number;
  startIndoorsWeeks?: number;
  minNightTemp?: number;
  spacingInches?: number;
  plantsPerSquare?: number;
  sun?: "full_sun" | "partial_sun" | "partial_shade" | "full_shade";
  growthHabit?: string;
  rating?: number;
  wouldGrowAgain?: number;
  yieldNotes?: string;
  notes?: string;
}

// ── Service Functions ───────────────────────────────────────────────────────

export async function search(userId: string, query: string) {
  const rows = await db
    .select()
    .from(catalogEntries)
    .where(
      and(
        eq(catalogEntries.userId, userId),
        ilike(catalogEntries.crop, `%${query}%`),
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
}

export async function create(userId: string, params: CreateCatalogParams) {
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
}

export async function get(userId: string, catalogId: string) {
  const [entry] = await db
    .select()
    .from(catalogEntries)
    .where(
      and(
        eq(catalogEntries.id, catalogId),
        eq(catalogEntries.userId, userId),
      ),
    );
  if (!entry) return { error: "Catalog entry not found" as const };
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
    rating: entry.rating,
    wouldGrowAgain: entry.wouldGrowAgain,
    yieldNotes: entry.yieldNotes,
    notes: entry.notes,
  };
}

export async function update(
  userId: string,
  catalogId: string,
  params: UpdateCatalogParams,
) {
  const [updated] = await db
    .update(catalogEntries)
    .set({ ...params, updatedAt: new Date() })
    .where(
      and(
        eq(catalogEntries.id, catalogId),
        eq(catalogEntries.userId, userId),
      ),
    )
    .returning();
  if (!updated) return { error: "Catalog entry not found" as const };
  return {
    id: updated.id,
    crop: updated.crop,
    variety: updated.variety,
    daysToMaturity: updated.daysToMaturity,
    startIndoorsWeeks: updated.startIndoorsWeeks,
  };
}

export async function del(userId: string, catalogId: string) {
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
}

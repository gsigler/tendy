import { eq, and } from "drizzle-orm";
import { db } from "../db/index.js";
import { gardens, seasons, plantings } from "../db/schema.js";

/**
 * Verify that a season belongs to the given user by walking the FK chain:
 * season -> garden -> user
 */
export async function verifySeasonOwnership(
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

/**
 * Verify that a planting belongs to the given user by walking:
 * planting -> season -> garden -> user
 */
export async function verifyPlantingOwnership(
  userId: string,
  plantingId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ gardenUserId: gardens.userId })
    .from(plantings)
    .innerJoin(seasons, eq(plantings.seasonId, seasons.id))
    .innerJoin(gardens, eq(seasons.gardenId, gardens.id))
    .where(and(eq(plantings.id, plantingId), eq(gardens.userId, userId)));
  return !!row;
}

/**
 * Verify that a garden belongs to the given user.
 */
export async function verifyGardenOwnership(
  userId: string,
  gardenId: string,
): Promise<boolean> {
  const [garden] = await db
    .select({ id: gardens.id })
    .from(gardens)
    .where(and(eq(gardens.id, gardenId), eq(gardens.userId, userId)));
  return !!garden;
}

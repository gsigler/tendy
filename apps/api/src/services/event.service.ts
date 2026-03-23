import { eq, desc } from "drizzle-orm";
import { db } from "../db/index.js";
import { events, plantings, spaces } from "../db/schema.js";
import { verifySeasonOwnership } from "./auth-checks.js";
import type { EventType } from "@tendy/shared";

// ── Types ───────────────────────────────────────────────────────────────────

export interface RecordEventParams {
  seasonId: string;
  type: EventType;
  summary: string;
  plantingId?: string;
  spaceId?: string;
  data?: Record<string, unknown>;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

async function verifyEventOwnership(
  userId: string,
  eventId: string,
): Promise<boolean> {
  const [event] = await db
    .select({ seasonId: events.seasonId })
    .from(events)
    .where(eq(events.id, eventId));
  if (!event) return false;
  return verifySeasonOwnership(userId, event.seasonId);
}

// ── Service Functions ───────────────────────────────────────────────────────

export async function listRecent(userId: string, seasonId: string, limit?: number) {
  if (!(await verifySeasonOwnership(userId, seasonId))) {
    return { error: "Season not found" as const };
  }
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
}

export async function record(userId: string, params: RecordEventParams) {
  if (!(await verifySeasonOwnership(userId, params.seasonId))) {
    return { error: "Season not found" as const };
  }
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
}

export async function del(userId: string, eventId: string) {
  if (!(await verifyEventOwnership(userId, eventId))) {
    return { error: "Event not found" as const };
  }
  await db.delete(events).where(eq(events.id, eventId));
  return { deleted: true, eventId };
}

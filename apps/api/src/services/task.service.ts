import { eq, and, asc } from "drizzle-orm";
import { db } from "../db/index.js";
import { tasks, plantings, spaces } from "../db/schema.js";
import { verifySeasonOwnership } from "./auth-checks.js";
import type { TaskType, TaskPriority } from "@tendy/shared";

// ── Types ───────────────────────────────────────────────────────────────────

export interface CreateTaskParams {
  seasonId: string;
  title: string;
  type?: TaskType;
  priority?: TaskPriority;
  dueAt?: string;
  plantingId?: string;
  spaceId?: string;
  notes?: string;
}

export interface UpdateTaskParams {
  title?: string;
  priority?: TaskPriority;
  dueAt?: string;
  notes?: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

async function verifyTaskOwnership(
  userId: string,
  taskId: string,
): Promise<boolean> {
  const [task] = await db
    .select({ seasonId: tasks.seasonId })
    .from(tasks)
    .where(eq(tasks.id, taskId));
  if (!task) return false;
  return verifySeasonOwnership(userId, task.seasonId);
}

// ── Service Functions ───────────────────────────────────────────────────────

export async function list(userId: string, seasonId: string, status?: string) {
  if (!(await verifySeasonOwnership(userId, seasonId))) {
    return { error: "Season not found" as const };
  }
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
}

export async function get(userId: string, taskId: string) {
  if (!(await verifyTaskOwnership(userId, taskId))) {
    return { error: "Task not found" as const };
  }
  const [row] = await db
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
    .where(eq(tasks.id, taskId));
  if (!row) return { error: "Task not found" as const };
  return {
    ...row,
    dueAt: row.dueAt?.toISOString() ?? null,
    isOverdue:
      row.status === "pending" && row.dueAt ? row.dueAt < new Date() : false,
  };
}

export async function create(userId: string, params: CreateTaskParams) {
  if (!(await verifySeasonOwnership(userId, params.seasonId))) {
    return { error: "Season not found" as const };
  }
  const [task] = await db
    .insert(tasks)
    .values({
      ...params,
      type: params.type ?? "other",
      priority: params.priority ?? "medium",
      dueAt: params.dueAt ? new Date(params.dueAt) : undefined,
    })
    .returning();
  return {
    id: task.id,
    title: task.title,
    type: task.type,
    priority: task.priority,
    dueAt: task.dueAt?.toISOString() ?? null,
  };
}

export async function update(
  userId: string,
  taskId: string,
  params: UpdateTaskParams,
) {
  if (!(await verifyTaskOwnership(userId, taskId))) {
    return { error: "Task not found" as const };
  }
  const { dueAt, ...updates } = params;
  const [updated] = await db
    .update(tasks)
    .set({
      ...updates,
      ...(dueAt ? { dueAt: new Date(dueAt) } : {}),
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, taskId))
    .returning();
  if (!updated) return { error: "Task not found" as const };
  return {
    id: updated.id,
    title: updated.title,
    priority: updated.priority,
    dueAt: updated.dueAt?.toISOString() ?? null,
  };
}

export async function complete(userId: string, taskId: string) {
  if (!(await verifyTaskOwnership(userId, taskId))) {
    return { error: "Task not found" as const };
  }
  const [updated] = await db
    .update(tasks)
    .set({
      status: "completed",
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, taskId))
    .returning();
  if (!updated) return { error: "Task not found" as const };
  return { id: updated.id, title: updated.title, status: "completed" as const };
}

export async function skip(userId: string, taskId: string) {
  if (!(await verifyTaskOwnership(userId, taskId))) {
    return { error: "Task not found" as const };
  }
  const [updated] = await db
    .update(tasks)
    .set({ status: "skipped", updatedAt: new Date() })
    .where(eq(tasks.id, taskId))
    .returning();
  if (!updated) return { error: "Task not found" as const };
  return { id: updated.id, title: updated.title, status: "skipped" as const };
}

export async function del(userId: string, taskId: string) {
  if (!(await verifyTaskOwnership(userId, taskId))) {
    return { error: "Task not found" as const };
  }
  await db.delete(tasks).where(eq(tasks.id, taskId));
  return { deleted: true, taskId };
}

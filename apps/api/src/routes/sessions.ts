import { Hono } from "hono";
import { eq, and, desc, asc } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  conversationSessions,
  conversationMessages,
} from "../db/schema.js";
import { CreateSessionSchema } from "@tendy/shared";
import type { AuthEnv } from "../middleware/auth.js";

export const sessions = new Hono<AuthEnv>();

// List user's sessions
sessions.get("/v1/chat/sessions", async (c) => {
  const userId = c.get("userId");
  const limit = Math.min(Number(c.req.query("limit")) || 50, 100);
  const offset = Number(c.req.query("offset")) || 0;

  const rows = await db
    .select()
    .from(conversationSessions)
    .where(eq(conversationSessions.userId, userId))
    .orderBy(desc(conversationSessions.lastMessageAt))
    .limit(limit)
    .offset(offset);

  return c.json(
    rows.map((s) => ({
      id: s.id,
      title: s.title,
      seasonId: s.seasonId,
      createdAt: s.createdAt.toISOString(),
      lastMessageAt: s.lastMessageAt?.toISOString() ?? null,
    })),
  );
});

// Create a new session
sessions.post("/v1/chat/sessions", async (c) => {
  const userId = c.get("userId");

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    body = {};
  }

  const parsed = CreateSessionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      400,
    );
  }

  const [session] = await db
    .insert(conversationSessions)
    .values({
      userId,
      seasonId: parsed.data.seasonId,
      title: parsed.data.title ?? "New conversation",
    })
    .returning();

  return c.json(
    {
      id: session.id,
      title: session.title,
      seasonId: session.seasonId,
      createdAt: session.createdAt.toISOString(),
    },
    201,
  );
});

// Get session with message history
sessions.get("/v1/chat/sessions/:id", async (c) => {
  const userId = c.get("userId");
  const sessionId = c.req.param("id");

  const [session] = await db
    .select()
    .from(conversationSessions)
    .where(
      and(
        eq(conversationSessions.id, sessionId),
        eq(conversationSessions.userId, userId),
      ),
    );

  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }

  const messages = await db
    .select()
    .from(conversationMessages)
    .where(eq(conversationMessages.sessionId, sessionId))
    .orderBy(asc(conversationMessages.createdAt))
    .limit(200);

  return c.json({
    id: session.id,
    title: session.title,
    seasonId: session.seasonId,
    createdAt: session.createdAt.toISOString(),
    lastMessageAt: session.lastMessageAt?.toISOString() ?? null,
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      richDisplays: m.toolCallsJson ?? undefined,
      createdAt: m.createdAt.toISOString(),
    })),
  });
});

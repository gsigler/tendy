import { Hono } from "hono";
import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import type { CoreMessage } from "ai";
import { eq, and, asc } from "drizzle-orm";
import { ChatRequestSchema } from "@tendy/shared";
import { db } from "../db/index.js";
import {
  conversationSessions,
  conversationMessages,
} from "../db/schema.js";
import { createTools } from "../agent/tools.js";
import { buildSystemPrompt } from "../agent/system-prompt.js";
import type { AuthEnv } from "../middleware/auth.js";

export const chat = new Hono<AuthEnv>();

chat.post("/v1/chat", async (c) => {
  const userId = c.get("userId");
  const userEmail = c.get("userEmail");

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  const parsed = ChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      400,
    );
  }

  const { message, sessionId: requestedSessionId } = parsed.data;

  // Get or create session
  let sessionId = requestedSessionId;
  if (sessionId) {
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
  } else {
    const [session] = await db
      .insert(conversationSessions)
      .values({
        userId,
        title: message.slice(0, 100),
      })
      .returning();
    sessionId = session.id;
  }

  // Load conversation history (last 50 messages for context window)
  const history = await db
    .select()
    .from(conversationMessages)
    .where(eq(conversationMessages.sessionId, sessionId))
    .orderBy(asc(conversationMessages.createdAt))
    .limit(50);

  const messages: CoreMessage[] = history
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content ?? "",
    }));

  // Add new user message
  messages.push({ role: "user", content: message });

  // Save user message
  await db.insert(conversationMessages).values({
    sessionId,
    role: "user",
    content: message,
  });

  const tools = createTools(userId);
  const systemPrompt = buildSystemPrompt({
    userEmail,
    today: new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
  });

  const result = streamText({
    model: openai("gpt-4o"),
    system: systemPrompt,
    messages,
    tools,
    maxSteps: 8,
    onFinish: async ({ text }) => {
      // Save assistant response
      if (text) {
        await db.insert(conversationMessages).values({
          sessionId: sessionId!,
          role: "assistant",
          content: text,
        });
      }

      // Update session timestamp
      await db
        .update(conversationSessions)
        .set({ lastMessageAt: new Date() })
        .where(eq(conversationSessions.id, sessionId!));
    },
  });

  // Return the response with session ID in header
  const response = result.toDataStreamResponse();
  response.headers.set("X-Session-Id", sessionId);
  return response;
});

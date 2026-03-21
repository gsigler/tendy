import { Hono } from "hono";
import { streamText, generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import type { CoreMessage } from "ai";
import { eq, and, asc, sql } from "drizzle-orm";
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

// How many recent messages to keep in full
const RECENT_MESSAGE_COUNT = 10;
// Summarize when total messages exceed this
const SUMMARIZE_THRESHOLD = 16;

async function summarizeOlderMessages(
  sessionId: string,
  existingSummary: string | null,
): Promise<void> {
  // Count total messages
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(conversationMessages)
    .where(eq(conversationMessages.sessionId, sessionId));

  if (count <= SUMMARIZE_THRESHOLD) return;

  // Get all messages except the most recent ones
  const allMessages = await db
    .select()
    .from(conversationMessages)
    .where(eq(conversationMessages.sessionId, sessionId))
    .orderBy(asc(conversationMessages.createdAt));

  const messagesToSummarize = allMessages.slice(
    0,
    allMessages.length - RECENT_MESSAGE_COUNT,
  );

  if (messagesToSummarize.length === 0) return;

  // Build content to summarize
  const conversationText = messagesToSummarize
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => `${m.role}: ${m.content ?? "(tool use)"}`)
    .join("\n");

  const summaryPrompt = existingSummary
    ? `You are summarizing a garden management conversation. Here is the previous summary:\n\n${existingSummary}\n\nHere are newer messages to incorporate:\n\n${conversationText}\n\nWrite an updated summary that captures all important context: what gardens/seasons/spaces exist, what was planted where, any decisions made, tasks created, and the user's preferences. Be concise but preserve actionable details. Do not include greetings or pleasantries.`
    : `Summarize this garden management conversation. Capture: what gardens/seasons/spaces exist, what was planted where, any decisions made, tasks created, and the user's preferences. Be concise but preserve actionable details.\n\n${conversationText}`;

  const modelId = process.env.OPENAI_MODEL || "gpt-4o-mini";

  try {
    const result = await generateText({
      model: openai(modelId),
      messages: [{ role: "user", content: summaryPrompt }],
      maxTokens: 500,
    });

    // Save summary to session
    await db
      .update(conversationSessions)
      .set({ summary: result.text })
      .where(eq(conversationSessions.id, sessionId));

    // Delete the summarized messages
    const idsToDelete = messagesToSummarize.map((m) => m.id);
    for (const id of idsToDelete) {
      await db
        .delete(conversationMessages)
        .where(eq(conversationMessages.id, id));
    }
  } catch (err) {
    // Non-fatal — if summarization fails, we just keep all messages
    console.error("Failed to summarize conversation:", err);
  }
}

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
  let sessionSummary: string | null = null;

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
    sessionSummary = session.summary;
  } else {
    const [session] = await db
      .insert(conversationSessions)
      .values({
        userId,
        title: message.slice(0, 100),
      })
      .returning();
    if (!session) {
      return c.json({ error: "Failed to create session" }, 500);
    }
    sessionId = session.id;
  }

  // Load recent conversation history
  const history = await db
    .select()
    .from(conversationMessages)
    .where(eq(conversationMessages.sessionId, sessionId))
    .orderBy(asc(conversationMessages.createdAt));

  const messages: CoreMessage[] = [];

  // Inject summary as context if it exists
  if (sessionSummary) {
    messages.push({
      role: "user",
      content: `[Previous conversation summary: ${sessionSummary}]`,
    });
    messages.push({
      role: "assistant",
      content:
        "Got it, I have the context from our previous conversation. How can I help?",
    });
  }

  // Add recent message history
  const recentHistory = history
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content ?? "",
    }));
  messages.push(...recentHistory);

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

  // Capture for async callback
  const sid = sessionId;
  const modelId = process.env.OPENAI_MODEL || "gpt-4o-mini";

  const result = streamText({
    model: openai(modelId),
    system: systemPrompt,
    messages,
    tools,
    maxSteps: 8,
    onFinish: async ({ text }) => {
      try {
        // Save assistant response
        if (text && text.trim()) {
          await db.insert(conversationMessages).values({
            sessionId: sid,
            role: "assistant",
            content: text,
          });
        }

        // Update session timestamp
        await db
          .update(conversationSessions)
          .set({ lastMessageAt: new Date() })
          .where(eq(conversationSessions.id, sid));

        // Auto-summarize if conversation is getting long
        const currentSummary = sessionSummary;
        await summarizeOlderMessages(sid, currentSummary);
      } catch (err) {
        console.error("Failed to persist chat response:", err);
      }
    },
  });

  // Return the response with session ID in header
  const response = result.toDataStreamResponse();
  response.headers.set("X-Session-Id", sid);
  return response;
});

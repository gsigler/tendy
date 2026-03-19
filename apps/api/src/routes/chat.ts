import { Hono } from "hono";
import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { ChatRequestSchema } from "@tendy/shared";

export const chat = new Hono();

chat.post("/chat", async (c) => {
  const body = await c.req.json();
  const parsed = ChatRequestSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Invalid request", details: parsed.error.flatten() }, 400);
  }

  const result = streamText({
    model: openai("gpt-4o-mini"),
    system:
      "You are Tendy, a friendly gardening assistant. " +
      "You help people plan, plant, and tend their gardens. " +
      "Keep responses concise and practical.",
    messages: [{ role: "user", content: parsed.data.message }],
  });

  return result.toDataStreamResponse();
});

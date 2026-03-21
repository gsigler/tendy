import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { auth } from "./routes/auth.js";
import { chat } from "./routes/chat.js";
import { sessions } from "./routes/sessions.js";
import { health } from "./routes/health.js";
import { authMiddleware } from "./middleware/auth.js";
import { rateLimiter } from "./middleware/rate-limit.js";
import { requestId } from "./middleware/request-id.js";

export const app = new Hono();

const allowedOrigins = process.env.CORS_ORIGINS?.split(",")
  .map((o) => o.trim())
  .filter((o) => o) ?? ["*"];

app.use("*", requestId);
app.use("*", logger());
app.use("*", cors({ origin: allowedOrigins }));

app.route("/", health);
app.route("/api", auth);

app.use("/api/v1/chat", authMiddleware);
app.use("/api/v1/chat/*", authMiddleware);

// Rate limit: 20 chat messages per minute per user
app.use("/api/v1/chat", rateLimiter(20, 60 * 1000));

app.route("/api", chat);
app.route("/api", sessions);

app.notFound((c) => {
  return c.json({ error: "Not found" }, 404);
});

app.onError((err, c) => {
  const rid = c.get("requestId" as never) || "unknown";
  console.error(`[${rid}] Unhandled error:`, err);
  return c.json({ error: "Internal server error" }, 500);
});

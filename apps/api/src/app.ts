import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { auth } from "./routes/auth.js";
import { health } from "./routes/health.js";
import { v1Routes } from "./routes/v1/index.js";
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
app.route("/api/v1", v1Routes);

app.notFound((c) => {
  return c.json({ error: "Not found" }, 404);
});

app.onError((err, c) => {
  const rid = c.get("requestId" as never) || "unknown";
  console.error(`[${rid}] Unhandled error:`, err);
  return c.json({ error: "Internal server error" }, 500);
});

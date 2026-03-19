import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { chat } from "./routes/chat.js";
import { health } from "./routes/health.js";

export const app = new Hono();

app.use("*", logger());
app.use("*", cors());

app.route("/", health);
app.route("/api", chat);

import { serve } from "@hono/node-server";
import { app } from "./app.js";
import { closeDb } from "./db/index.js";

// Validate required env vars at startup
const required = ["DATABASE_URL", "JWT_SECRET"];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

if (!process.env.OPENAI_API_KEY) {
  console.warn(
    "WARNING: OPENAI_API_KEY not set — chat endpoint will fail. Set it in .env",
  );
}

const port = Number(process.env.PORT) || 3000;

const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Tendy API running on http://localhost:${info.port}`);
});

function shutdown() {
  console.log("Shutting down...");
  server.close(() => {
    closeDb().then(() => process.exit(0));
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

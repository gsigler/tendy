import { serve } from "@hono/node-server";
import { app } from "./app.js";
import { closeDb } from "./db/index.js";

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

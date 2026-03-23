import { createServer } from "node:http";
import { getRequestListener } from "@hono/node-server";
import { app } from "./app.js";
import { closeDb } from "./db/index.js";
import { handleMcpRequest } from "./mcp/transport.js";

// Validate required env vars at startup
const required = ["DATABASE_URL", "JWT_SECRET"];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const port = Number(process.env.PORT) || 3000;

const nodeHandler = getRequestListener(app.fetch);

const server = createServer(async (req, res) => {
  // MCP requires raw Node.js streams for SSE — must bypass Hono
  if (req.url?.startsWith("/mcp")) {
    try {
      await handleMcpRequest(req, res);
    } catch (e) {
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Internal server error" }));
      }
    }
    return;
  }
  // Everything else goes to Hono
  nodeHandler(req, res);
});

server.listen(port, () => {
  console.log(`Tendy API running on http://localhost:${port}`);
});

function shutdown() {
  console.log("Shutting down...");
  server.close(() => {
    closeDb().then(() => process.exit(0));
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

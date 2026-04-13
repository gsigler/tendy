import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import express from "express";
import { getRequestListener } from "@hono/node-server";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { mcpAuthRouter } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { app } from "./app.js";
import { closeDb } from "./db/index.js";
import { handleStreamableRequest, handleSseRequest } from "./mcp/transport.js";
import { TendyOAuthProvider } from "./oauth/provider.js";
import { authenticateBearer } from "./middleware/auth.js";

// Validate required env vars at startup
const required = ["DATABASE_URL", "JWT_SECRET"];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

// Run migrations before starting the server
console.log("Running database migrations...");
const migrationClient = postgres(process.env.DATABASE_URL!, { max: 1 });
const migrationDb = drizzle(migrationClient);
const migrationsFolder = new URL("../drizzle", import.meta.url).pathname;
await migrate(migrationDb, { migrationsFolder });
await migrationClient.end();
console.log("Migrations complete.");

const port = Number(process.env.PORT) || 3000;
const baseUrl = process.env.BASE_URL || `http://localhost:${port}`;

// ── OAuth + MCP setup ─────────────────────────────────────────────────

const oauthProvider = new TendyOAuthProvider();

// Express app for OAuth endpoints (SDK's auth router requires Express)
const expressApp = express();

// Parse URL-encoded bodies for the login form
expressApp.use(express.urlencoded({ extended: false }));
expressApp.use(express.json());

// Install the SDK's OAuth auth router at the root
// This provides:
//   /.well-known/oauth-authorization-server
//   /.well-known/oauth-protected-resource/mcp
//   /authorize
//   /token
//   /register
//   /revoke
expressApp.use(
  mcpAuthRouter({
    provider: oauthProvider,
    issuerUrl: new URL(baseUrl),
    baseUrl: new URL(baseUrl),
    serviceDocumentationUrl: new URL(baseUrl),
    resourceServerUrl: new URL("/mcp", baseUrl),
  }),
);

// Handle the login form POST (submitted from /authorize page)
expressApp.post("/oauth/login", async (req, res) => {
  const { email, password, client_id, redirect_uri, code_challenge, state, scope, resource } = req.body;

  if (!email || !password || !client_id || !redirect_uri || !code_challenge) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const result = await oauthProvider.handleLogin({
    email,
    password,
    client_id,
    redirect_uri,
    code_challenge,
    state: state || undefined,
    scope: scope || undefined,
    resource: resource || undefined,
  });

  if ("error" in result) {
    const safeError = result.error.replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
    );
    res.status(401).send(`<!DOCTYPE html>
<html><head><title>Login Failed</title>
<style>body{font-family:sans-serif;background:#0f1117;color:#e4e4e7;display:flex;justify-content:center;align-items:center;min-height:100vh;}.card{background:#1c1c22;border-radius:12px;padding:2rem;max-width:400px;text-align:center;}a{color:#22c55e;}</style>
</head><body><div class="card"><h2>Login Failed</h2><p>${safeError}</p><p><a href="javascript:history.back()">Try again</a></p></div></body></html>`);
    return;
  }

  res.redirect(result.redirectUrl);
});

// Bearer auth middleware for MCP endpoint (Express-compatible)
const mcpBearerAuth = requireBearerAuth({
  verifier: oauthProvider,
  resourceMetadataUrl: new URL("/.well-known/oauth-protected-resource/mcp", baseUrl).href,
});

// Streamable HTTP MCP endpoint (Express route -> raw Node.js handler)
expressApp.all("/mcp", mcpBearerAuth, async (req, res) => {
  // Cast to raw Node.js types — the Express req/res extend IncomingMessage/ServerResponse
  await handleStreamableRequest(
    req as unknown as IncomingMessage & { auth?: import("@modelcontextprotocol/sdk/server/auth/types.js").AuthInfo },
    res as unknown as ServerResponse,
  );
});

// ── Node.js HTTP server ───────────────────────────────────────────────

const honoHandler = getRequestListener(app.fetch);

const server = createServer(async (req, res) => {
  const url = req.url || "";

  // Legacy SSE transport (backward compat)
  if (url.startsWith("/sse")) {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Unauthorized" }));
        return;
      }
      const auth = await authenticateBearer(authHeader.slice(7));
      if (!auth) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid or expired token" }));
        return;
      }
      await handleSseRequest(req, res, auth.userId);
    } catch (e) {
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Internal server error" }));
      }
    }
    return;
  }

  // OAuth endpoints, MCP Streamable HTTP, and well-known metadata
  if (
    url.startsWith("/mcp") ||
    url.startsWith("/.well-known/") ||
    url.startsWith("/authorize") ||
    url.startsWith("/token") ||
    url.startsWith("/register") ||
    url.startsWith("/revoke") ||
    url.startsWith("/oauth/")
  ) {
    expressApp(req, res);
    return;
  }

  // Everything else goes to Hono (REST API)
  honoHandler(req, res);
});

server.listen(port, () => {
  console.log(`Tendy API running on ${baseUrl}`);
  console.log(`  MCP (Streamable HTTP): ${baseUrl}/mcp`);
  console.log(`  MCP (Legacy SSE):      ${baseUrl}/sse`);
  console.log(`  OAuth metadata:        ${baseUrl}/.well-known/oauth-authorization-server`);
});

function shutdown() {
  console.log("Shutting down...");
  server.close(() => {
    closeDb().then(() => process.exit(0));
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

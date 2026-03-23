import type { IncomingMessage, ServerResponse } from "node:http";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { createMcpServer } from "./server.js";
import { authenticateBearer } from "../middleware/auth.js";

interface SessionEntry {
  transport: SSEServerTransport;
  userId: string;
}

const sessions = new Map<string, SessionEntry>();

async function authenticate(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<string | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Unauthorized" }));
    return null;
  }
  const auth = await authenticateBearer(authHeader.slice(7));
  if (!auth) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid or expired token" }));
    return null;
  }
  return auth.userId;
}

/**
 * Handle MCP SSE transport: GET /mcp establishes the SSE stream,
 * POST /mcp/message sends messages to the transport.
 *
 * NOTE: This runs at the Node.js http level (outside Hono) because SSE
 * requires holding the raw socket open — Hono's response lifecycle closes it.
 * Logging is handled here directly.
 */
export async function handleMcpRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const userId = await authenticate(req, res);
  if (!userId) return;

  const url = new URL(req.url || "", `http://${req.headers.host}`);
  console.log(`  [MCP] ${req.method} ${url.pathname} sessions=${[...sessions.keys()].join(",") || "none"}`);

  // GET /mcp — establish SSE stream
  if (req.method === "GET" && url.pathname === "/mcp") {
    console.log(`  <-- MCP GET /mcp (new SSE connection) userId=${userId}`);
    const transport = new SSEServerTransport("/mcp/message", res);
    const server = createMcpServer(userId);

    transport.onclose = () => {
      console.log(`  --> MCP session closed sessionId=${transport.sessionId}`);
      if (transport.sessionId) {
        sessions.delete(transport.sessionId);
      }
    };

    await server.connect(transport);

    if (transport.sessionId) {
      sessions.set(transport.sessionId, { transport, userId });
      console.log(`  --> MCP session established sessionId=${transport.sessionId}`);
    }
    return;
  }

  // POST /mcp/message — send message to existing session
  if (req.method === "POST" && url.pathname === "/mcp/message") {
    const sessionId = url.searchParams.get("sessionId");
    if (!sessionId) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing sessionId query parameter" }));
      return;
    }
    const session = sessions.get(sessionId);
    if (!session) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Session not found" }));
      return;
    }
    if (session.userId !== userId) {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Forbidden" }));
      return;
    }
    console.log(`  <-- MCP POST /mcp/message sessionId=${sessionId}`);
    await session.transport.handlePostMessage(req, res);
    return;
  }

  res.writeHead(405, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Method not allowed" }));
}

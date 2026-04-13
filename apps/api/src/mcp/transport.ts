import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { createMcpServer } from "./server.js";

// ── Streamable HTTP transport (primary, for connectors) ───────────────

interface StreamableSession {
  transport: StreamableHTTPServerTransport;
  userId: string;
}

const streamableSessions = new Map<string, StreamableSession>();

/**
 * Handle Streamable HTTP transport at /mcp.
 * Supports POST (JSON-RPC messages), GET (SSE listener), DELETE (session end).
 *
 * The `req.auth` property should be set by auth middleware before calling this.
 */
export async function handleStreamableRequest(
  req: IncomingMessage & { auth?: AuthInfo },
  res: ServerResponse,
): Promise<void> {
  const userId = req.auth?.extra?.userId as string | undefined;
  if (!userId) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Unauthorized" }));
    return;
  }

  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  // Route to existing session
  if (sessionId && streamableSessions.has(sessionId)) {
    const session = streamableSessions.get(sessionId)!;

    // Enforce session-user binding
    if (session.userId !== userId) {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Forbidden" }));
      return;
    }

    await session.transport.handleRequest(req, res);
    return;
  }

  // For DELETE with unknown session, return 404
  if (req.method === "DELETE") {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Session not found" }));
    return;
  }

  // For non-init requests with an unknown session ID, return 404
  if (sessionId) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Session not found" }));
    return;
  }

  // New session — only POST with InitializeRequest should reach here
  if (req.method !== "POST") {
    res.writeHead(405, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });

  const server = createMcpServer(userId);
  await server.connect(transport);

  transport.onclose = () => {
    if (transport.sessionId) {
      streamableSessions.delete(transport.sessionId);
      console.log(`  [MCP/Streamable] session closed id=${transport.sessionId}`);
    }
  };

  // Handle the InitializeRequest — this sets transport.sessionId
  await transport.handleRequest(req, res);

  if (transport.sessionId) {
    streamableSessions.set(transport.sessionId, { transport, userId });
    console.log(`  [MCP/Streamable] session created id=${transport.sessionId} userId=${userId}`);
  }
}

// ── Legacy SSE transport (backward compat at /sse) ────────────────────

interface SseSession {
  transport: SSEServerTransport;
  userId: string;
}

const sseSessions = new Map<string, SseSession>();

/**
 * Handle legacy SSE transport: GET /sse establishes the SSE stream,
 * POST /sse/message sends messages to the transport.
 */
export async function handleSseRequest(
  req: IncomingMessage,
  res: ServerResponse,
  userId: string,
): Promise<void> {
  const url = new URL(req.url || "", `http://${req.headers.host}`);
  console.log(`  [MCP/SSE] ${req.method} ${url.pathname}`);

  // GET /sse — establish SSE stream
  if (req.method === "GET" && url.pathname === "/sse") {
    const transport = new SSEServerTransport("/sse/message", res);
    const server = createMcpServer(userId);

    transport.onclose = () => {
      if (transport.sessionId) {
        sseSessions.delete(transport.sessionId);
        console.log(`  [MCP/SSE] session closed id=${transport.sessionId}`);
      }
    };

    await server.connect(transport);

    if (transport.sessionId) {
      sseSessions.set(transport.sessionId, { transport, userId });
      console.log(`  [MCP/SSE] session created id=${transport.sessionId}`);
    }
    return;
  }

  // POST /sse/message — send message to existing session
  if (req.method === "POST" && url.pathname === "/sse/message") {
    const sessionId = url.searchParams.get("sessionId");
    if (!sessionId) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing sessionId query parameter" }));
      return;
    }
    const session = sseSessions.get(sessionId);
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
    await session.transport.handlePostMessage(req, res);
    return;
  }

  res.writeHead(405, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Method not allowed" }));
}

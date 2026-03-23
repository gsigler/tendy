import type { IncomingMessage, ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer } from "./server.js";
import { authenticateBearer } from "../middleware/auth.js";

interface SessionEntry {
  transport: StreamableHTTPServerTransport;
  userId: string;
}

const sessions = new Map<string, SessionEntry>();

/**
 * Extract and verify JWT from the Authorization header.
 * Returns the userId or writes an error response and returns null.
 */
async function authenticate(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<string | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Missing or invalid Authorization header" }));
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
 * Handle all MCP HTTP requests (POST, GET, DELETE) on /mcp.
 *
 * - POST without mcp-session-id: initialize a new session
 * - POST/GET/DELETE with mcp-session-id: route to existing session transport
 */
export async function handleMcpRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  // Authenticate every request
  const userId = await authenticate(req, res);
  if (!userId) return;

  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  // Route to existing session if we have a session ID
  if (sessionId) {
    const session = sessions.get(sessionId);
    if (!session) {
      // Session not found — client should re-initialize
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Session not found" }));
      return;
    }
    // Ensure the session belongs to this user
    if (session.userId !== userId) {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Session does not belong to this user" }));
      return;
    }
    await session.transport.handleRequest(req, res);
    return;
  }

  // No session ID — must be a POST to initialize a new session
  if (req.method !== "POST") {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Missing mcp-session-id header. Send a POST to initialize a session first." }));
    return;
  }

  // Create new transport and MCP server for this user
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
  });
  const server = createMcpServer(userId);

  transport.onclose = () => {
    if (transport.sessionId) {
      sessions.delete(transport.sessionId);
    }
  };

  await server.connect(transport);

  if (transport.sessionId) {
    sessions.set(transport.sessionId, { transport, userId });
  }

  await transport.handleRequest(req, res);
}

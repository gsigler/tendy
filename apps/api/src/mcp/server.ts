import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAllTools } from "./tools/index.js";

export function createMcpServer(userId: string): McpServer {
  const server = new McpServer({
    name: "tendy",
    version: "1.0.0",
  });
  registerAllTools(server, userId);
  return server;
}

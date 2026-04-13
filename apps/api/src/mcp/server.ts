import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAllTools } from "./tools/index.js";

const LEAF_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.9C15.5 4.9 17 3.5 19 2c1 2 2 4.5 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>`;

const LEAF_ICON_DATA_URI = `data:image/svg+xml;base64,${Buffer.from(LEAF_ICON_SVG).toString("base64")}`;

export function createMcpServer(userId: string): McpServer {
  const server = new McpServer({
    name: "tendy",
    version: "1.0.0",
    icons: [{ src: LEAF_ICON_DATA_URI, mimeType: "image/svg+xml" }],
  });
  registerAllTools(server, userId);
  return server;
}

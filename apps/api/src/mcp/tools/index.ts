import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerGardenTools } from "./garden.tools.js";
import { registerSeasonTools } from "./season.tools.js";
import { registerSpaceTools } from "./space.tools.js";
import { registerPlantingTools } from "./planting.tools.js";
import { registerTaskTools } from "./task.tools.js";
import { registerEventTools } from "./event.tools.js";
import { registerCatalogTools } from "./catalog.tools.js";
import { registerPlanningTools } from "./planning.tools.js";
import { registerHarvestTools } from "./harvest.tools.js";

export function registerAllTools(server: McpServer, userId: string) {
  registerGardenTools(server, userId);
  registerSeasonTools(server, userId);
  registerSpaceTools(server, userId);
  registerPlantingTools(server, userId);
  registerTaskTools(server, userId);
  registerEventTools(server, userId);
  registerCatalogTools(server, userId);
  registerPlanningTools(server, userId);
  registerHarvestTools(server, userId);
}

import { Hono } from "hono";
import type { AuthEnv } from "../../middleware/auth.js";
import { authMiddleware } from "../../middleware/auth.js";
import { gardens } from "./gardens.js";
import { seasons } from "./seasons.js";
import { spaces } from "./spaces.js";
import { plantings } from "./plantings.js";
import { tasks } from "./tasks.js";
import { events } from "./events.js";
import { catalog } from "./catalog.js";
import { planning } from "./planning.js";
import { harvestsRoutes } from "./harvests.js";
import { apiKeysRoutes } from "./api-keys.js";

export const v1Routes = new Hono<AuthEnv>();

// All v1 routes require authentication
v1Routes.use("*", authMiddleware);

// Mount route groups
v1Routes.route("/api-keys", apiKeysRoutes);
v1Routes.route("/gardens", gardens);
v1Routes.route("/", seasons);
v1Routes.route("/", spaces);
v1Routes.route("/", plantings);
v1Routes.route("/", tasks);
v1Routes.route("/", events);
v1Routes.route("/catalog", catalog);
v1Routes.route("/", planning);
v1Routes.route("/", harvestsRoutes);

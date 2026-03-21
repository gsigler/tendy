import { describe, it, expect, beforeEach } from "vitest";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { createTools } from "../agent/tools.js";
import { cleanDb } from "./helpers.js";
import bcrypt from "bcryptjs";

let userId: string;
let tools: ReturnType<typeof createTools>;

async function createTestUser() {
  const [user] = await db
    .insert(users)
    .values({
      email: `tools-${Date.now()}@example.com`,
      name: "Tool Tester",
      passwordHash: await bcrypt.hash("password123", 4),
    })
    .returning();
  return user;
}

describe("Agent tools", () => {
  beforeEach(async () => {
    await cleanDb();

    const user = await createTestUser();
    userId = user.id;
    tools = createTools(userId);
  });

  // Helper to call tool.execute with required options
  const opts = { toolCallId: "test", messages: [], abortSignal: undefined as never };



  describe("Garden tools", () => {
    it("creates and lists gardens", async () => {
      const created = await tools.createGarden.execute(
        { name: "My Backyard", location: "Portland, OR", hardinessZone: "8b" },
        opts,
      );
      expect(created.name).toBe("My Backyard");
      expect(created.id).toBeTypeOf("string");

      const list = await tools.listGardens.execute({}, opts);
      expect(list).toHaveLength(1);
      expect(list[0].name).toBe("My Backyard");
    });
  });

  describe("Season tools", () => {
    it("creates and lists seasons", async () => {
      const garden = await tools.createGarden.execute(
        { name: "Test Garden" },
        opts,
      );

      const season = await tools.createSeason.execute(
        {
          gardenId: garden.id,
          year: 2026,
          name: "Spring 2026",
          lastFrostDate: "2026-04-15T00:00:00Z",
          firstFrostDate: "2026-10-15T00:00:00Z",
        },
        opts,
      );
      expect(season.name).toBe("Spring 2026");

      const list = await tools.listSeasons.execute(
        { gardenId: garden.id },
        opts,
      );
      expect(list).toHaveLength(1);
    });

    it("returns error for wrong user's garden", async () => {
      const otherUser = await createTestUser();
      const otherTools = createTools(otherUser.id);
      const garden = await otherTools.createGarden.execute(
        { name: "Not yours" },
        opts,
      );

      const result = await tools.createSeason.execute(
        { gardenId: garden.id, year: 2026, name: "Test" },
        opts,
      );
      expect(result).toHaveProperty("error");
    });

    it("gets season summary", async () => {
      const garden = await tools.createGarden.execute(
        { name: "Summary Garden" },
        opts,
      );
      const season = await tools.createSeason.execute(
        { gardenId: garden.id, year: 2026, name: "Spring" },
        opts,
      );

      const summary = await tools.getSeasonSummary.execute(
        { seasonId: season.id },
        opts,
      );
      expect(summary.season.name).toBe("Spring");
      expect(summary.plantingCount).toBe(0);
      expect(summary.spaces).toHaveLength(0);
    });
  });

  describe("Space tools", () => {
    let seasonId: string;

    beforeEach(async () => {
      const garden = await tools.createGarden.execute(
        { name: "Space Garden" },
        opts,
      );
      const season = await tools.createSeason.execute(
        { gardenId: garden.id, year: 2026, name: "Spring" },
        opts,
      );
      seasonId = season.id;
    });

    it("creates and lists spaces", async () => {
      await tools.createSpace.execute(
        { seasonId, name: "Sunny Bed", type: "RaisedBed", width: 4, length: 8 },
        opts,
      );

      const list = await tools.listSpaces.execute({ seasonId }, opts);
      expect(list).toHaveLength(1);
      expect(list[0].name).toBe("Sunny Bed");
      expect(list[0].type).toBe("RaisedBed");
    });
  });

  describe("Planting tools", () => {
    let seasonId: string;
    let spaceId: string;

    beforeEach(async () => {
      const garden = await tools.createGarden.execute(
        { name: "Planting Garden" },
        opts,
      );
      const season = await tools.createSeason.execute(
        { gardenId: garden.id, year: 2026, name: "Spring" },
        opts,
      );
      seasonId = season.id;
      const space = await tools.createSpace.execute(
        { seasonId, name: "Bed 1", type: "RaisedBed" },
        opts,
      );
      spaceId = space.id;
    });

    it("creates and lists plantings", async () => {
      await tools.createPlanting.execute(
        { seasonId, crop: "Tomato", variety: "Sun Gold", spaceId },
        opts,
      );
      await tools.createPlanting.execute(
        { seasonId, crop: "Basil", variety: "Genovese" },
        opts,
      );

      const list = await tools.listPlantings.execute({ seasonId }, opts);
      expect(list).toHaveLength(2);
    });

    it("filters plantings by stage", async () => {
      const planting = await tools.createPlanting.execute(
        { seasonId, crop: "Tomato" },
        opts,
      );
      await tools.advanceStage.execute(
        { plantingId: planting.id, newStage: "seeded_indoors" },
        opts,
      );

      const planned = await tools.listPlantings.execute(
        { seasonId, stage: "planned" },
        opts,
      );
      expect(planned).toHaveLength(0);

      const seeded = await tools.listPlantings.execute(
        { seasonId, stage: "seeded_indoors" },
        opts,
      );
      expect(seeded).toHaveLength(1);
    });

    it("advances stage and sets timestamps", async () => {
      const planting = await tools.createPlanting.execute(
        { seasonId, crop: "Pepper" },
        opts,
      );

      const advanced = await tools.advanceStage.execute(
        { plantingId: planting.id, newStage: "seeded_indoors" },
        opts,
      );
      expect(advanced.stage).toBe("seeded_indoors");
      expect(advanced.startedAt).toBeTypeOf("string");
    });

    it("updates health and creates event", async () => {
      const planting = await tools.createPlanting.execute(
        { seasonId, crop: "Tomato" },
        opts,
      );

      const updated = await tools.updateHealth.execute(
        { plantingId: planting.id, health: "fair", reason: "Some yellowing leaves" },
        opts,
      );
      expect(updated.health).toBe("fair");

      const recentEvents = await tools.listRecentEvents.execute(
        { seasonId },
        opts,
      );
      expect(recentEvents.length).toBeGreaterThan(0);
      expect(recentEvents[0].summary).toContain("yellowing");
    });

    it("moves planting to a different space", async () => {
      const planting = await tools.createPlanting.execute(
        { seasonId, crop: "Tomato", spaceId },
        opts,
      );

      const newSpace = await tools.createSpace.execute(
        { seasonId, name: "Bed 2", type: "RaisedBed" },
        opts,
      );

      const moved = await tools.movePlanting.execute(
        { plantingId: planting.id, newSpaceId: newSpace.id },
        opts,
      );
      expect(moved.newSpaceId).toBe(newSpace.id);
    });

    it("deletes a planting", async () => {
      const planting = await tools.createPlanting.execute(
        { seasonId, crop: "Tomato" },
        opts,
      );

      await tools.deletePlanting.execute({ plantingId: planting.id }, opts);

      const list = await tools.listPlantings.execute({ seasonId }, opts);
      expect(list).toHaveLength(0);
    });
  });

  describe("Task tools", () => {
    let seasonId: string;

    beforeEach(async () => {
      const garden = await tools.createGarden.execute(
        { name: "Task Garden" },
        opts,
      );
      const season = await tools.createSeason.execute(
        { gardenId: garden.id, year: 2026, name: "Spring" },
        opts,
      );
      seasonId = season.id;
    });

    it("creates, lists, completes, and skips tasks", async () => {
      const task1 = await tools.createTask.execute(
        {
          seasonId,
          title: "Water beds",
          type: "maintenance",
          priority: "high",
          dueAt: new Date().toISOString(),
        },
        opts,
      );
      const task2 = await tools.createTask.execute(
        {
          seasonId,
          title: "Check seedlings",
          dueAt: new Date(Date.now() + 86400000).toISOString(),
        },
        opts,
      );

      const list = await tools.listTasks.execute({ seasonId }, opts);
      expect(list).toHaveLength(2);

      const completed = await tools.completeTask.execute(
        { taskId: task1.id },
        opts,
      );
      expect(completed.status).toBe("completed");

      const skipped = await tools.skipTask.execute(
        { taskId: task2.id },
        opts,
      );
      expect(skipped.status).toBe("skipped");

      const pendingList = await tools.listTasks.execute(
        { seasonId, status: "pending" },
        opts,
      );
      expect(pendingList).toHaveLength(0);
    });
  });

  describe("Event tools", () => {
    let seasonId: string;

    beforeEach(async () => {
      const garden = await tools.createGarden.execute(
        { name: "Event Garden" },
        opts,
      );
      const season = await tools.createSeason.execute(
        { gardenId: garden.id, year: 2026, name: "Spring" },
        opts,
      );
      seasonId = season.id;
    });

    it("records and lists events", async () => {
      await tools.recordObservation.execute(
        {
          seasonId,
          type: "watering",
          summary: "Watered all beds",
        },
        opts,
      );
      await tools.recordObservation.execute(
        {
          seasonId,
          type: "harvest",
          summary: "Harvested 3 lbs of tomatoes",
          data: { quantity: 3, unit: "lbs", crop: "Tomato" },
        },
        opts,
      );

      const list = await tools.listRecentEvents.execute({ seasonId }, opts);
      expect(list).toHaveLength(2);
    });
  });

  describe("Catalog tools", () => {
    it("creates and searches catalog entries", async () => {
      await tools.createCatalogEntry.execute(
        {
          crop: "Tomato",
          variety: "Sun Gold",
          daysToMaturity: 65,
          startIndoorsWeeks: 6,
          sun: "full_sun",
        },
        opts,
      );
      await tools.createCatalogEntry.execute(
        {
          crop: "Tomato",
          variety: "Cherokee Purple",
          daysToMaturity: 80,
        },
        opts,
      );

      const results = await tools.searchCatalog.execute(
        { crop: "tomato" },
        opts,
      );
      expect(results).toHaveLength(2);
    });

    it("gets a catalog entry by id", async () => {
      const created = await tools.createCatalogEntry.execute(
        { crop: "Basil", variety: "Genovese", daysToMaturity: 60 },
        opts,
      );

      const entry = await tools.getCatalogEntry.execute(
        { catalogId: created.id },
        opts,
      );
      expect(entry.crop).toBe("Basil");
      expect(entry.daysToMaturity).toBe(60);
    });
  });

  describe("Week plan", () => {
    it("returns overdue tasks, upcoming tasks, and active plantings", async () => {
      const garden = await tools.createGarden.execute(
        { name: "Plan Garden" },
        opts,
      );
      const season = await tools.createSeason.execute(
        { gardenId: garden.id, year: 2026, name: "Spring" },
        opts,
      );

      // Create an overdue task
      await tools.createTask.execute(
        {
          seasonId: season.id,
          title: "Overdue task",
          dueAt: new Date(Date.now() - 86400000).toISOString(),
        },
        opts,
      );

      // Create an upcoming task
      await tools.createTask.execute(
        {
          seasonId: season.id,
          title: "Upcoming task",
          dueAt: new Date(Date.now() + 3 * 86400000).toISOString(),
        },
        opts,
      );

      // Create an active planting
      await tools.createPlanting.execute(
        { seasonId: season.id, crop: "Tomato" },
        opts,
      );

      const plan = await tools.getWeekPlan.execute(
        { seasonId: season.id },
        opts,
      );
      expect(plan.overdueTasks).toHaveLength(1);
      expect(plan.upcomingTasks).toHaveLength(1);
      expect(plan.activePlantings).toHaveLength(1);
    });
  });

  describe("Grid placement tools", () => {
    it("places and removes plantings on grid", async () => {
      const garden = await tools.createGarden.execute(
        { name: "Grid Garden" },
        opts,
      );
      const season = await tools.createSeason.execute(
        { gardenId: garden.id, year: 2026, name: "Spring" },
        opts,
      );
      const space = await tools.createSpace.execute(
        { seasonId: season.id, name: "Grid Bed", type: "RaisedBed", width: 4, length: 4 },
        opts,
      );
      const planting = await tools.createPlanting.execute(
        { seasonId: season.id, crop: "Lettuce", spaceId: space.id },
        opts,
      );

      // Place on grid
      await tools.placeOnGrid.execute(
        {
          spaceId: space.id,
          plantingId: planting.id,
          cells: [
            { row: 0, col: 0 },
            { row: 0, col: 1 },
          ],
        },
        opts,
      );

      const grid = await tools.getSpaceGrid.execute(
        { spaceId: space.id },
        opts,
      );
      expect(grid.placements).toHaveLength(2);

      // Remove from grid
      await tools.removeFromGrid.execute(
        { spaceId: space.id, plantingId: planting.id },
        opts,
      );

      const gridAfter = await tools.getSpaceGrid.execute(
        { spaceId: space.id },
        opts,
      );
      expect(gridAfter.placements).toHaveLength(0);
    });
  });
});

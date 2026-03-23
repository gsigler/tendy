import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as taskService from "../../services/task.service.js";

export function registerTaskTools(server: McpServer, userId: string) {
  server.tool(
    "listTasks",
    "List all tasks in a season, ordered by due date. Optionally filter by status (pending, completed, skipped). Includes overdue flag.",
    {
      seasonId: z.string().describe("ID of the season"),
      status: z.string().optional().describe("Filter by task status: 'pending', 'completed', or 'skipped'"),
    },
    async ({ seasonId, status }) => {
      try {
        const tasks = await taskService.list(userId, seasonId, status);
        return { content: [{ type: "text", text: JSON.stringify(tasks, null, 2) }] };
      } catch (e) {
        console.error("[mcp] tool error:", e);
        return { content: [{ type: "text", text: "An error occurred. Please try again." }], isError: true };
      }
    },
  );

  server.tool(
    "getTask",
    "Get details of a specific task by ID",
    {
      taskId: z.string().describe("Task ID"),
    },
    async ({ taskId }) => {
      try {
        const task = await taskService.get(userId, taskId);
        if (!task) return { content: [{ type: "text" as const, text: "Task not found" }], isError: true };
        return { content: [{ type: "text" as const, text: JSON.stringify(task, null, 2) }] };
      } catch (e) {
        console.error("[mcp] tool error:", e);
        return { content: [{ type: "text" as const, text: "An error occurred. Please try again." }], isError: true };
      }
    },
  );

  server.tool(
    "createTask",
    "Create a new task in a season. Can optionally link to a planting and/or space. Types: seed_start, transplant, check, harvest, maintenance, other.",
    {
      seasonId: z.string().describe("ID of the season"),
      title: z.string().describe("Task title"),
      type: z.enum(["seed_start", "transplant", "check", "harvest", "maintenance", "other"]).optional().describe("Task type (defaults to 'other')"),
      priority: z.enum(["low", "medium", "high"]).optional().describe("Task priority (defaults to 'medium')"),
      dueAt: z.string().optional().describe("Due date (ISO string)"),
      plantingId: z.string().optional().describe("ID of related planting"),
      spaceId: z.string().optional().describe("ID of related space"),
      notes: z.string().optional().describe("Additional notes"),
    },
    async (params) => {
      try {
        const task = await taskService.create(userId, params);
        return { content: [{ type: "text", text: JSON.stringify(task, null, 2) }] };
      } catch (e) {
        console.error("[mcp] tool error:", e);
        return { content: [{ type: "text", text: "An error occurred. Please try again." }], isError: true };
      }
    },
  );

  server.tool(
    "updateTask",
    "Update a task's title, priority, due date, or notes. Only provided fields are changed.",
    {
      taskId: z.string().describe("ID of the task to update"),
      title: z.string().optional().describe("New task title"),
      priority: z.enum(["low", "medium", "high"]).optional().describe("New priority"),
      dueAt: z.string().optional().describe("New due date (ISO string)"),
      notes: z.string().optional().describe("New notes"),
    },
    async ({ taskId, ...params }) => {
      try {
        const result = await taskService.update(userId, taskId, params);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        console.error("[mcp] tool error:", e);
        return { content: [{ type: "text", text: "An error occurred. Please try again." }], isError: true };
      }
    },
  );

  server.tool(
    "completeTask",
    "Mark a task as completed. Sets completedAt timestamp.",
    {
      taskId: z.string().describe("ID of the task to complete"),
    },
    async ({ taskId }) => {
      try {
        const result = await taskService.complete(userId, taskId);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        console.error("[mcp] tool error:", e);
        return { content: [{ type: "text", text: "An error occurred. Please try again." }], isError: true };
      }
    },
  );

  server.tool(
    "skipTask",
    "Mark a task as skipped (e.g. no longer relevant).",
    {
      taskId: z.string().describe("ID of the task to skip"),
    },
    async ({ taskId }) => {
      try {
        const result = await taskService.skip(userId, taskId);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        console.error("[mcp] tool error:", e);
        return { content: [{ type: "text", text: "An error occurred. Please try again." }], isError: true };
      }
    },
  );

  server.tool(
    "deleteTask",
    "Delete a task permanently.",
    {
      taskId: z.string().describe("ID of the task to delete"),
    },
    async ({ taskId }) => {
      try {
        const result = await taskService.del(userId, taskId);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        console.error("[mcp] tool error:", e);
        return { content: [{ type: "text", text: "An error occurred. Please try again." }], isError: true };
      }
    },
  );
}

import { z } from "zod";

// ── Enums ──────────────────────────────────────────────────────────────────

export const PlantingStage = z.enum([
  "planned",
  "seeded_indoors",
  "seedling",
  "hardening_off",
  "transplanted",
  "direct_sown",
  "producing",
  "finished",
  "failed",
]);
export type PlantingStage = z.infer<typeof PlantingStage>;

export const HealthStatus = z.enum([
  "healthy",
  "fair",
  "poor",
  "critical",
  "dead",
]);
export type HealthStatus = z.infer<typeof HealthStatus>;

export const SeasonStatus = z.enum(["planning", "active", "complete"]);
export type SeasonStatus = z.infer<typeof SeasonStatus>;

export const SpaceType = z.enum([
  "RaisedBed",
  "Tray",
  "Container",
  "RowBed",
  "Shelf",
  "HardeningArea",
]);
export type SpaceType = z.infer<typeof SpaceType>;

export const TaskType = z.enum([
  "seed_start",
  "transplant",
  "check",
  "harvest",
  "maintenance",
  "other",
]);
export type TaskType = z.infer<typeof TaskType>;

export const TaskStatus = z.enum([
  "pending",
  "completed",
  "skipped",
]);
export type TaskStatus = z.infer<typeof TaskStatus>;

export const TaskPriority = z.enum(["low", "medium", "high"]);
export type TaskPriority = z.infer<typeof TaskPriority>;

export const SourceType = z.enum(["seed", "start"]);
export type SourceType = z.infer<typeof SourceType>;

export const EventType = z.enum([
  "observation",
  "watering",
  "fertilizing",
  "harvest",
  "pest",
  "disease",
  "weather",
  "stage_change",
  "planting",
  "maintenance",
  "other",
]);
export type EventType = z.infer<typeof EventType>;

// ── Auth Schemas ───────────────────────────────────────────────────────────

export const RegisterRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
});
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

// ── Chat Schemas ───────────────────────────────────────────────────────────

export const ChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const ChatRequestSchema = z.object({
  message: z.string().min(1).max(4000),
  sessionId: z.string().uuid().optional(),
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

// ── Session Schemas ────────────────────────────────────────────────────────

export const CreateSessionSchema = z.object({
  seasonId: z.string().uuid().optional(),
  title: z.string().optional(),
});
export type CreateSession = z.infer<typeof CreateSessionSchema>;

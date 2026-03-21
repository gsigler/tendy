import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  real,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ── Users ──────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  gardens: many(gardens),
  conversationSessions: many(conversationSessions),
}));

// ── Gardens ────────────────────────────────────────────────────────────────

export const gardens = pgTable("gardens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  location: text("location"),
  hardinessZone: text("hardiness_zone"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const gardensRelations = relations(gardens, ({ one, many }) => ({
  user: one(users, { fields: [gardens.userId], references: [users.id] }),
  seasons: many(seasons),
}));

// ── Seasons ────────────────────────────────────────────────────────────────

export const seasons = pgTable("seasons", {
  id: uuid("id").defaultRandom().primaryKey(),
  gardenId: uuid("garden_id")
    .notNull()
    .references(() => gardens.id),
  year: integer("year").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("planning"),
  lastFrostDate: timestamp("last_frost_date", { withTimezone: true }),
  firstFrostDate: timestamp("first_frost_date", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const seasonsRelations = relations(seasons, ({ one, many }) => ({
  garden: one(gardens, {
    fields: [seasons.gardenId],
    references: [gardens.id],
  }),
  spaces: many(spaces),
  plantings: many(plantings),
  tasks: many(tasks),
  events: many(events),
}));

// ── Spaces ─────────────────────────────────────────────────────────────────

export const spaces = pgTable("spaces", {
  id: uuid("id").defaultRandom().primaryKey(),
  seasonId: uuid("season_id")
    .notNull()
    .references(() => seasons.id),
  name: text("name").notNull(),
  type: text("type").notNull().default("RaisedBed"),
  layoutMode: text("layout_mode").default("grid"),
  width: integer("width"),
  length: integer("length"),
  unit: text("unit").default("ft"),
  sunExposure: text("sun_exposure"),
  sortOrder: integer("sort_order").default(0),
  posX: integer("pos_x"),
  posY: integer("pos_y"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const spacesRelations = relations(spaces, ({ one, many }) => ({
  season: one(seasons, {
    fields: [spaces.seasonId],
    references: [seasons.id],
  }),
  plantings: many(plantings),
  gridPlacements: many(gridPlacements),
}));

// ── Catalog Entries ────────────────────────────────────────────────────────

export const catalogEntries = pgTable(
  "catalog_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    crop: text("crop").notNull(),
    variety: text("variety"),
    vendor: text("vendor"),
    url: text("url"),
    sourceType: text("source_type").default("seed"),
    daysToMaturity: integer("days_to_maturity"),
    startIndoorsWeeks: integer("start_indoors_weeks"),
    minNightTemp: integer("min_night_temp"),
    spacingInches: integer("spacing_inches"),
    plantsPerSquare: integer("plants_per_square"),
    sun: text("sun"),
    growthHabit: text("growth_habit"),
    gridSquares: integer("grid_squares"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("catalog_entries_user_crop_variety_idx").on(
      table.userId,
      table.crop,
      table.variety,
    ),
  ],
);

export const catalogEntriesRelations = relations(
  catalogEntries,
  ({ one, many }) => ({
    user: one(users, {
      fields: [catalogEntries.userId],
      references: [users.id],
    }),
    plantings: many(plantings),
    reviews: many(catalogReviews),
  }),
);

// ── Plantings ──────────────────────────────────────────────────────────────

export const plantings = pgTable("plantings", {
  id: uuid("id").defaultRandom().primaryKey(),
  seasonId: uuid("season_id")
    .notNull()
    .references(() => seasons.id),
  catalogId: uuid("catalog_id").references(() => catalogEntries.id),
  spaceId: uuid("space_id").references(() => spaces.id),
  crop: text("crop").notNull(),
  variety: text("variety"),
  sourceType: text("source_type").notNull().default("seed"),
  stage: text("stage").notNull().default("planned"),
  health: text("health").notNull().default("healthy"),
  quantity: integer("quantity"),
  quantityUnit: text("quantity_unit"),
  gridSquares: integer("grid_squares"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  hardenedAt: timestamp("hardened_at", { withTimezone: true }),
  transplantedAt: timestamp("transplanted_at", { withTimezone: true }),
  targetStartDate: timestamp("target_start_date", { withTimezone: true }),
  targetHardenDate: timestamp("target_harden_date", { withTimezone: true }),
  targetTransplantDate: timestamp("target_transplant_date", {
    withTimezone: true,
  }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const plantingsRelations = relations(plantings, ({ one, many }) => ({
  season: one(seasons, {
    fields: [plantings.seasonId],
    references: [seasons.id],
  }),
  catalog: one(catalogEntries, {
    fields: [plantings.catalogId],
    references: [catalogEntries.id],
  }),
  space: one(spaces, { fields: [plantings.spaceId], references: [spaces.id] }),
  events: many(events),
  gridPlacements: many(gridPlacements),
}));

// ── Catalog Reviews ────────────────────────────────────────────────────────

export const catalogReviews = pgTable(
  "catalog_reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    catalogId: uuid("catalog_id")
      .notNull()
      .references(() => catalogEntries.id),
    seasonId: uuid("season_id")
      .notNull()
      .references(() => seasons.id),
    plantingId: uuid("planting_id").references(() => plantings.id),
    rating: integer("rating"),
    yieldNotes: text("yield_notes"),
    wouldGrowAgain: integer("would_grow_again"),
    review: text("review"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("catalog_reviews_catalog_season_idx").on(
      table.catalogId,
      table.seasonId,
    ),
  ],
);

export const catalogReviewsRelations = relations(catalogReviews, ({ one }) => ({
  catalog: one(catalogEntries, {
    fields: [catalogReviews.catalogId],
    references: [catalogEntries.id],
  }),
  season: one(seasons, {
    fields: [catalogReviews.seasonId],
    references: [seasons.id],
  }),
  planting: one(plantings, {
    fields: [catalogReviews.plantingId],
    references: [plantings.id],
  }),
}));

// ── Events ─────────────────────────────────────────────────────────────────

export const events = pgTable("events", {
  id: uuid("id").defaultRandom().primaryKey(),
  seasonId: uuid("season_id")
    .notNull()
    .references(() => seasons.id),
  plantingId: uuid("planting_id").references(() => plantings.id),
  spaceId: uuid("space_id").references(() => spaces.id),
  type: text("type").notNull(),
  happenedAt: timestamp("happened_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  summary: text("summary"),
  dataJson: jsonb("data_json"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const eventsRelations = relations(events, ({ one }) => ({
  season: one(seasons, {
    fields: [events.seasonId],
    references: [seasons.id],
  }),
  planting: one(plantings, {
    fields: [events.plantingId],
    references: [plantings.id],
  }),
  space: one(spaces, { fields: [events.spaceId], references: [spaces.id] }),
}));

// ── Grid Placements ────────────────────────────────────────────────────────

export const gridPlacements = pgTable(
  "grid_placements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    spaceId: uuid("space_id")
      .notNull()
      .references(() => spaces.id),
    plantingId: uuid("planting_id")
      .notNull()
      .references(() => plantings.id),
    row: integer("row").notNull(),
    col: integer("col").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("grid_placements_space_row_col_idx").on(
      table.spaceId,
      table.row,
      table.col,
    ),
  ],
);

export const gridPlacementsRelations = relations(gridPlacements, ({ one }) => ({
  space: one(spaces, {
    fields: [gridPlacements.spaceId],
    references: [spaces.id],
  }),
  planting: one(plantings, {
    fields: [gridPlacements.plantingId],
    references: [plantings.id],
  }),
}));

// ── Tasks ──────────────────────────────────────────────────────────────────

export const tasks = pgTable("tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  seasonId: uuid("season_id")
    .notNull()
    .references(() => seasons.id),
  plantingId: uuid("planting_id").references(() => plantings.id),
  spaceId: uuid("space_id").references(() => spaces.id),
  title: text("title").notNull(),
  type: text("type").notNull().default("other"),
  status: text("status").notNull().default("pending"),
  priority: text("priority").notNull().default("medium"),
  dueAt: timestamp("due_at", { withTimezone: true }),
  notes: text("notes"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const tasksRelations = relations(tasks, ({ one }) => ({
  season: one(seasons, { fields: [tasks.seasonId], references: [seasons.id] }),
  planting: one(plantings, {
    fields: [tasks.plantingId],
    references: [plantings.id],
  }),
  space: one(spaces, { fields: [tasks.spaceId], references: [spaces.id] }),
}));

// ── Conversation Sessions ──────────────────────────────────────────────────

export const conversationSessions = pgTable("conversation_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  seasonId: uuid("season_id").references(() => seasons.id),
  title: text("title"),
  summary: text("summary"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
});

export const conversationSessionsRelations = relations(
  conversationSessions,
  ({ one, many }) => ({
    user: one(users, {
      fields: [conversationSessions.userId],
      references: [users.id],
    }),
    season: one(seasons, {
      fields: [conversationSessions.seasonId],
      references: [seasons.id],
    }),
    messages: many(conversationMessages),
  }),
);

// ── Conversation Messages ──────────────────────────────────────────────────

export const conversationMessages = pgTable("conversation_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => conversationSessions.id),
  role: text("role").notNull(),
  content: text("content"),
  toolCallId: text("tool_call_id"),
  toolCallsJson: jsonb("tool_calls_json"),
  tokenCount: integer("token_count"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const conversationMessagesRelations = relations(
  conversationMessages,
  ({ one }) => ({
    session: one(conversationSessions, {
      fields: [conversationMessages.sessionId],
      references: [conversationSessions.id],
    }),
  }),
);

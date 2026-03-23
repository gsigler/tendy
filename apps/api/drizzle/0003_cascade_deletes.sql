-- Create api_keys table
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"prefix" varchar(8) NOT NULL,
	"key_hash" varchar(255) NOT NULL,
	"last_used_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Create harvests table
CREATE TABLE "harvests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"planting_id" uuid,
	"space_id" uuid,
	"crop" text NOT NULL,
	"variety" text,
	"quantity" real,
	"quantity_unit" text,
	"weight_oz" real,
	"harvested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"quality" text DEFAULT 'good',
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Add missing columns to catalog_entries
ALTER TABLE "catalog_entries" ADD COLUMN IF NOT EXISTS "rating" integer;--> statement-breakpoint
ALTER TABLE "catalog_entries" ADD COLUMN IF NOT EXISTS "would_grow_again" integer;--> statement-breakpoint
ALTER TABLE "catalog_entries" ADD COLUMN IF NOT EXISTS "yield_notes" text;--> statement-breakpoint

-- Add FK for api_keys with cascade
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- Add FKs for harvests with cascade
ALTER TABLE "harvests" ADD CONSTRAINT "harvests_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "harvests" ADD CONSTRAINT "harvests_planting_id_plantings_id_fk" FOREIGN KEY ("planting_id") REFERENCES "public"."plantings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "harvests" ADD CONSTRAINT "harvests_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

-- Update existing FK constraints to use cascade/set null
-- catalog_entries
ALTER TABLE "catalog_entries" DROP CONSTRAINT "catalog_entries_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "catalog_entries" ADD CONSTRAINT "catalog_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- gardens
ALTER TABLE "gardens" DROP CONSTRAINT "gardens_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "gardens" ADD CONSTRAINT "gardens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- seasons
ALTER TABLE "seasons" DROP CONSTRAINT "seasons_garden_id_gardens_id_fk";--> statement-breakpoint
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_garden_id_gardens_id_fk" FOREIGN KEY ("garden_id") REFERENCES "public"."gardens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- spaces
ALTER TABLE "spaces" DROP CONSTRAINT "spaces_season_id_seasons_id_fk";--> statement-breakpoint
ALTER TABLE "spaces" ADD CONSTRAINT "spaces_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- plantings
ALTER TABLE "plantings" DROP CONSTRAINT "plantings_season_id_seasons_id_fk";--> statement-breakpoint
ALTER TABLE "plantings" ADD CONSTRAINT "plantings_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plantings" DROP CONSTRAINT "plantings_catalog_id_catalog_entries_id_fk";--> statement-breakpoint
ALTER TABLE "plantings" ADD CONSTRAINT "plantings_catalog_id_catalog_entries_id_fk" FOREIGN KEY ("catalog_id") REFERENCES "public"."catalog_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plantings" DROP CONSTRAINT "plantings_space_id_spaces_id_fk";--> statement-breakpoint
ALTER TABLE "plantings" ADD CONSTRAINT "plantings_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

-- events
ALTER TABLE "events" DROP CONSTRAINT "events_season_id_seasons_id_fk";--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" DROP CONSTRAINT "events_planting_id_plantings_id_fk";--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_planting_id_plantings_id_fk" FOREIGN KEY ("planting_id") REFERENCES "public"."plantings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" DROP CONSTRAINT "events_space_id_spaces_id_fk";--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

-- grid_placements
ALTER TABLE "grid_placements" DROP CONSTRAINT "grid_placements_space_id_spaces_id_fk";--> statement-breakpoint
ALTER TABLE "grid_placements" ADD CONSTRAINT "grid_placements_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grid_placements" DROP CONSTRAINT "grid_placements_planting_id_plantings_id_fk";--> statement-breakpoint
ALTER TABLE "grid_placements" ADD CONSTRAINT "grid_placements_planting_id_plantings_id_fk" FOREIGN KEY ("planting_id") REFERENCES "public"."plantings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- tasks
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_season_id_seasons_id_fk";--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_planting_id_plantings_id_fk";--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_planting_id_plantings_id_fk" FOREIGN KEY ("planting_id") REFERENCES "public"."plantings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_space_id_spaces_id_fk";--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE set null ON UPDATE no action;

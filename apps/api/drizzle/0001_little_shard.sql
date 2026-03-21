CREATE TABLE "catalog_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"crop" text NOT NULL,
	"variety" text,
	"vendor" text,
	"url" text,
	"source_type" text DEFAULT 'seed',
	"days_to_maturity" integer,
	"start_indoors_weeks" integer,
	"min_night_temp" integer,
	"spacing_inches" integer,
	"plants_per_square" integer,
	"sun" text,
	"growth_habit" text,
	"grid_squares" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"catalog_id" uuid NOT NULL,
	"season_id" uuid NOT NULL,
	"planting_id" uuid,
	"rating" integer,
	"yield_notes" text,
	"would_grow_again" integer,
	"review" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text,
	"tool_call_id" text,
	"tool_calls_json" jsonb,
	"token_count" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"season_id" uuid,
	"title" text,
	"summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_message_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"planting_id" uuid,
	"space_id" uuid,
	"type" text NOT NULL,
	"happened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"summary" text,
	"data_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gardens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"location" text,
	"hardiness_zone" text,
	"latitude" real,
	"longitude" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grid_placements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" uuid NOT NULL,
	"planting_id" uuid NOT NULL,
	"row" integer NOT NULL,
	"col" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plantings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"catalog_id" uuid,
	"space_id" uuid,
	"crop" text NOT NULL,
	"variety" text,
	"source_type" text DEFAULT 'seed' NOT NULL,
	"stage" text DEFAULT 'planned' NOT NULL,
	"health" text DEFAULT 'healthy' NOT NULL,
	"quantity" integer,
	"quantity_unit" text,
	"grid_squares" integer,
	"started_at" timestamp with time zone,
	"hardened_at" timestamp with time zone,
	"transplanted_at" timestamp with time zone,
	"target_start_date" timestamp with time zone,
	"target_harden_date" timestamp with time zone,
	"target_transplant_date" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seasons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"garden_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'planning' NOT NULL,
	"last_frost_date" timestamp with time zone,
	"first_frost_date" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'RaisedBed' NOT NULL,
	"layout_mode" text DEFAULT 'grid',
	"width" integer,
	"length" integer,
	"unit" text DEFAULT 'ft',
	"sun_exposure" text,
	"sort_order" integer DEFAULT 0,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"planting_id" uuid,
	"space_id" uuid,
	"title" text NOT NULL,
	"type" text DEFAULT 'other' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"due_at" timestamp with time zone,
	"notes" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "catalog_entries" ADD CONSTRAINT "catalog_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_reviews" ADD CONSTRAINT "catalog_reviews_catalog_id_catalog_entries_id_fk" FOREIGN KEY ("catalog_id") REFERENCES "public"."catalog_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_reviews" ADD CONSTRAINT "catalog_reviews_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_reviews" ADD CONSTRAINT "catalog_reviews_planting_id_plantings_id_fk" FOREIGN KEY ("planting_id") REFERENCES "public"."plantings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_session_id_conversation_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."conversation_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_sessions" ADD CONSTRAINT "conversation_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_sessions" ADD CONSTRAINT "conversation_sessions_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_planting_id_plantings_id_fk" FOREIGN KEY ("planting_id") REFERENCES "public"."plantings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gardens" ADD CONSTRAINT "gardens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grid_placements" ADD CONSTRAINT "grid_placements_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grid_placements" ADD CONSTRAINT "grid_placements_planting_id_plantings_id_fk" FOREIGN KEY ("planting_id") REFERENCES "public"."plantings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plantings" ADD CONSTRAINT "plantings_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plantings" ADD CONSTRAINT "plantings_catalog_id_catalog_entries_id_fk" FOREIGN KEY ("catalog_id") REFERENCES "public"."catalog_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plantings" ADD CONSTRAINT "plantings_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_garden_id_gardens_id_fk" FOREIGN KEY ("garden_id") REFERENCES "public"."gardens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spaces" ADD CONSTRAINT "spaces_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_planting_id_plantings_id_fk" FOREIGN KEY ("planting_id") REFERENCES "public"."plantings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "catalog_entries_user_crop_variety_idx" ON "catalog_entries" USING btree ("user_id","crop","variety");--> statement-breakpoint
CREATE UNIQUE INDEX "catalog_reviews_catalog_season_idx" ON "catalog_reviews" USING btree ("catalog_id","season_id");--> statement-breakpoint
CREATE UNIQUE INDEX "grid_placements_space_row_col_idx" ON "grid_placements" USING btree ("space_id","row","col");
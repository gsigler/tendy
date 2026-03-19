# 06 — Data Architecture

[← Back to Plan Index](README.md)

---

**Total: 19 tables** (10 core domain + 9 agent infrastructure)

## Core Tables (10 entities)

- **User** — id, email, password_hash, created_at
- **Garden** — id, user_id FK, name, location, hardiness_zone, latitude, longitude, timestamps
- **Season** — garden FK, year, name, status, last_frost_date, first_frost_date, timestamps
- **Space** — season FK, name, type, layout_mode, width, length, unit, sun_exposure, sort_order, notes, timestamps
- **Planting** — season FK, catalog FK, space FK, crop, variety, source_type, stage, health, quantity, quantity_unit, grid_squares, started_at, hardened_at, transplanted_at, target_start_date, target_harden_date, target_transplant_date, notes, timestamps
- **CatalogEntry** — user_id FK, crop, variety, unique(user_id, crop, variety), vendor, url, source_type, days_to_maturity, start_indoors_weeks, min_night_temp, spacing_inches, plants_per_square, sun, growth_habit, grid_squares, tags (text[]), notes, timestamps
- **CatalogReview** — catalog FK, season FK, unique(catalog_id, season_id), planting FK, rating, yield_notes, would_grow_again, review, created_at
- **Event** — season FK, planting/space FK, type, happened_at, summary, data_json (jsonb), created_at. **Immutable.**
- **GridPlacement** — space FK, planting FK, unique(space_id, row, col), row, col, created_at
- **Task** — season FK, planting/space FK, title, type, status, priority, due_at, notes, timestamps, completed_at

---

## Agent Tables (9 entities)

```sql
-- Conversation sessions with metadata
CREATE TABLE conversation_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    season_id UUID NOT NULL REFERENCES seasons(id),
    title TEXT,                          -- auto-generated from first message
    summary TEXT,                        -- compressed summary of older messages
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_message_at TIMESTAMPTZ
);

-- Conversation messages (extended from original plan)
CREATE TABLE conversation_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES conversation_sessions(id),
    user_id UUID NOT NULL REFERENCES users(id),
    role TEXT NOT NULL,                  -- 'system', 'user', 'assistant', 'tool'
    content TEXT,
    tool_call_id TEXT,
    tool_calls_json JSONB,
    token_count INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Agent execution history (full observability)
CREATE TABLE agent_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    agent_type TEXT NOT NULL,            -- 'chat', 'planning', 'observation', 'notification'
    trigger TEXT NOT NULL,               -- 'user_message', 'scheduled', 'weather_alert', 'photo_upload'
    session_id UUID,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'running',
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    total_cost_cents INTEGER DEFAULT 0,
    tool_calls_json JSONB DEFAULT '[]',
    error_message TEXT,
    prompt_version TEXT
);

-- Agent recommendations (Planning Agent output)
CREATE TABLE agent_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    season_id UUID NOT NULL REFERENCES seasons(id),
    planting_id UUID REFERENCES plantings(id),
    agent_type TEXT NOT NULL,
    category TEXT NOT NULL,              -- 'frost_warning', 'schedule_adjustment', 'health_alert'
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    suggested_action JSONB,
    confidence REAL NOT NULL DEFAULT 0.5,
    status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'accepted', 'dismissed', 'auto_executed'
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ
);

-- User notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    recommendation_id UUID REFERENCES agent_recommendations(id),
    channel TEXT NOT NULL DEFAULT 'in_app',
    priority TEXT NOT NULL DEFAULT 'normal',
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Agent memory: learned facts about user's garden over time
CREATE TABLE agent_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    category TEXT NOT NULL,              -- 'preference', 'learned_fact', 'garden_condition'
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    confidence REAL NOT NULL DEFAULT 0.8,
    source TEXT NOT NULL,                -- 'user_stated', 'agent_inferred', 'observation'
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, category, key)
);

-- Photos with observation data
CREATE TABLE photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    season_id UUID NOT NULL REFERENCES seasons(id),
    planting_id UUID REFERENCES plantings(id),
    space_id UUID REFERENCES spaces(id),
    storage_key TEXT NOT NULL,
    content_type TEXT NOT NULL,
    thumbnail_key TEXT,
    observation_json JSONB,              -- Observation Agent output
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Weather data cache
CREATE TABLE weather_cache (
    user_id UUID NOT NULL REFERENCES users(id),
    forecast_date DATE NOT NULL,
    data_json JSONB NOT NULL,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, forecast_date)
);

-- Token usage tracking (budget enforcement)
CREATE TABLE token_usage (
    user_id UUID NOT NULL REFERENCES users(id),
    agent_type TEXT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, agent_type, date)
);
```

---

## Key Design Decisions

- **UUIDv7** for all primary keys (time-ordered, avoids B-tree fragmentation on append-heavy tables like events and agent_runs)
- **Enum storage as strings** with `varchar(30)` constraints — readable, migration-safe
- **Tags as `text[]`** on CatalogEntry — PostgreSQL native array with GIN index for fast `@>` queries
- **Denormalize `user_id` on Season** — simplifies authorization. EF Core global query filter on Garden checks user_id; Season gets it from Garden FK
- **Slim tool-response DTOs** — agents receive `{ crop, variety, stage, space_name }`, not full entities with 20 fields. Minimizes token waste.

---

## Key Indexes

```sql
CREATE INDEX idx_events_season_date ON events(season_id, happened_at DESC);
CREATE INDEX idx_tasks_season_status ON tasks(season_id, status, due_at);
CREATE INDEX idx_plantings_season_stage ON plantings(season_id, stage);
CREATE INDEX idx_messages_session ON conversation_messages(session_id, created_at);
CREATE INDEX idx_agent_runs_user ON agent_runs(user_id, agent_type, started_at DESC);
CREATE INDEX idx_recommendations_pending ON agent_recommendations(user_id, status)
    WHERE status = 'pending';
CREATE INDEX idx_notifications_unread ON notifications(user_id, created_at DESC)
    WHERE read_at IS NULL;
```

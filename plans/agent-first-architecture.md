# Tend API — C# Agent-First Architecture

## Context

Redesign the "tend" garden management CLI (TypeScript/Bun/SQLite) as a C# Web API with an **agent-first architecture** using Microsoft Agent Framework. The agent is the primary interface — users interact via natural language — but a traditional REST API provides direct CRUD access. Both layers share a single service layer so business rules are enforced identically.

### Key Decisions
- **Multi-user** with authentication (garden ownership per user)
- **PostgreSQL** database (EF Core + Npgsql)
- **OpenAI direct** as initial LLM provider
- **Streaming SSE** for the agent chat endpoint

---

## Solution Structure

```
Tend.sln
├── src/
│   ├── Tend.Domain/                 # Pure domain: entities, enums, interfaces
│   │   ├── Entities/
│   │   ├── Enums/
│   │   └── Interfaces/              # Repository + service interfaces
│   │
│   ├── Tend.Application/            # Business logic, DTOs, computed views
│   │   ├── Services/                # PlantingService, PlanningService, etc.
│   │   ├── Models/                  # DTOs, request/response, WeekPlan, Summary
│   │   └── Auth/                    # ICurrentUserService interface
│   │
│   ├── Tend.Infrastructure/         # EF Core + PostgreSQL, repository impls
│   │   └── Data/
│   │       ├── TendDbContext.cs
│   │       ├── Configurations/      # Per-entity EF config
│   │       └── Migrations/
│   │
│   ├── Tend.Agent/                  # Agent layer: plugins (tools) for AI agent
│   │   ├── Plugins/                 # GardenPlugin, PlantingPlugin, PlanningPlugin...
│   │   └── AgentFactory.cs          # Builds ChatClientAgent with tools + system prompt
│   │
│   └── Tend.Api/                    # ASP.NET Core host (composition root)
│       ├── Controllers/             # REST endpoints
│       ├── Auth/                    # JWT/cookie auth, CurrentUserService impl
│       └── Program.cs               # DI wiring, endpoint mapping
│
└── tests/
    ├── Tend.Application.Tests/
    └── Tend.Api.Tests/
```

**Stack:**
- .NET 8 LTS
- EF Core + Npgsql (PostgreSQL)
- Microsoft Agent Framework (`Microsoft.Agents.AI`, `Microsoft.Agents.AI.OpenAI`)
- ASP.NET Core with JWT bearer auth
- OpenAI SDK (`OpenAI` NuGet) for LLM

---

## Authentication & Multi-User

- JWT bearer token auth on all endpoints
- `Users` table: id (Guid), email, password_hash, created_at
- Gardens are owned by users (`Garden.UserId` FK)
- `ICurrentUserService` injected into services — all queries scoped to the authenticated user
- Agent endpoint also requires auth — the agent operates on the authenticated user's gardens

---

## Domain Model

### Enums (stored as strings in PostgreSQL)

| Enum | Values |
|------|--------|
| SeasonStatus | Planned, Active, Completed |
| SpaceType | RaisedBed, Tray, Container, RowBed, Shelf, HardeningArea |
| LayoutMode | SquareFootGrid, Rows, CellGrid, None |
| PlantingStage | Planned, SeededIndoors, Seedling, HardeningOff, DirectSown, Transplanted, Producing, Finished, Failed |
| HealthStatus | Healthy, Watch, Stressed, PestIssue, Diseased, Dead |
| SourceType | Seed, Start |
| SunRequirement | FullSun, PartSun, Shade |
| EventType | Created, Seeded, Transplanted, Observed, Harvested, TaskCompleted, HealthChanged, StageChanged, Note |
| TaskType | SeedStart, Transplant, Check, Harvest, Maintenance, Other |
| TaskStatus | Open, Done, Skipped |
| Priority | Low, Medium, High |

### Entities (10 tables — original 9 + Users)

- **User** — id, email, password_hash, created_at
- **Garden** — id, user_id FK, name, timestamps
- **Season** — garden FK, year, name, status, last_frost_date, first_frost_date, timestamps
- **Space** — season FK, name, type, layout_mode, width, length, unit, sort_order, notes, timestamps
- **Planting** — season FK, catalog FK (nullable), space FK (nullable), crop, variety, source_type, source, stage, health, quantity, quantity_unit, grid_squares, started_at, hardened_at, transplanted_at, target_start_date, target_harden_date, target_transplant_date, notes, timestamps
- **CatalogEntry** — user_id FK, crop, variety, unique(user_id, crop, variety), vendor, url, source_type, days_to_maturity, start_indoors_weeks, min_night_temp, spacing_inches, plants_per_square, sun, growth_habit, grid_squares, tags, notes, timestamps
- **CatalogReview** — catalog FK (cascade), season FK, unique(catalog_id, season_id), planting FK (nullable), rating 1-5, yield_notes, would_grow_again, review, created_at
- **Event** — season FK, planting/space FK (nullable), type, happened_at, summary, data_json (jsonb), created_at. **Immutable.**
- **GridPlacement** — space FK (cascade), planting FK (cascade), unique(space_id, row, col), row, col, created_at
- **Task** — season FK, planting/space FK (nullable), title, type, status, priority, due_at, notes, timestamps, completed_at
- **ConversationMessage** — session_id, user_id FK, role, content, created_at (for persisting agent chat history)

IDs: `Guid`. Catalog uniqueness is per-user (so different users can have the same crop+variety). Event.data_json uses PostgreSQL `jsonb` type.

---

## Service Layer

Shared by both REST controllers and agent plugins. All services receive `ICurrentUserService` to scope queries.

| Service | Responsibilities |
|---------|-----------------|
| `IAuthService` | Register, login, JWT token generation |
| `IGardenService` | Garden CRUD (scoped to user), season CRUD, activate/complete season |
| `IPlantingService` | Planting CRUD, **stage transitions** (auto-sets timestamps + creates events), health updates, space moves (clears grid) |
| `ISpaceService` | Space CRUD within a season |
| `ICatalogService` | Catalog entry CRUD (unique per user+crop+variety), review upsert (one per catalog+season) |
| `IEventService` | Append-only event recording, filtered listing. No update/delete. |
| `ITaskService` | Task CRUD, complete/skip |
| `IGridService` | Place/remove plantings on grid cells |
| `IPlanningService` | **Computed views**: SeasonSummary, WeekPlan, PlantingSchedule, auto-task generation (idempotent) |

### Key Business Rules

- **Stage transitions** → auto-set timestamp fields (started_at, hardened_at, transplanted_at) + create StageChanged event
- **Moving planting to new space** → clear all grid placements for that planting
- **Deleting planting** → cascade delete events, tasks, grid placements
- **Catalog review** → upsert (one per catalog entry per season)
- **Auto-task generation** → idempotent: checks for existing open task of same type+planting before creating
- **WeekPlan** → overdue tasks, upcoming tasks (next 7 days), suggestions based on planting stages and last activity

---

## REST API

All endpoints under `/api/v1`, require JWT auth. Controllers are thin — validate, call service, return DTO.

```
POST   /api/v1/auth/register
POST   /api/v1/auth/login

GET    /api/v1/gardens
POST   /api/v1/gardens
GET    /api/v1/gardens/{id}
PUT    /api/v1/gardens/{id}
DELETE /api/v1/gardens/{id}

GET    /api/v1/gardens/{gardenId}/seasons
POST   /api/v1/gardens/{gardenId}/seasons
GET    /api/v1/seasons/{id}
PUT    /api/v1/seasons/{id}
POST   /api/v1/seasons/{id}/activate
POST   /api/v1/seasons/{id}/complete

GET    /api/v1/seasons/{seasonId}/spaces
POST   /api/v1/seasons/{seasonId}/spaces
GET    /api/v1/spaces/{id}
PUT    /api/v1/spaces/{id}
DELETE /api/v1/spaces/{id}

GET    /api/v1/seasons/{seasonId}/plantings
POST   /api/v1/seasons/{seasonId}/plantings
GET    /api/v1/plantings/{id}
PUT    /api/v1/plantings/{id}
POST   /api/v1/plantings/{id}/stage
POST   /api/v1/plantings/{id}/health
POST   /api/v1/plantings/{id}/move
DELETE /api/v1/plantings/{id}

GET    /api/v1/catalog
POST   /api/v1/catalog
GET    /api/v1/catalog/{id}
PUT    /api/v1/catalog/{id}
DELETE /api/v1/catalog/{id}
PUT    /api/v1/catalog/{id}/reviews/{seasonId}

GET    /api/v1/seasons/{seasonId}/events
POST   /api/v1/seasons/{seasonId}/events

GET    /api/v1/seasons/{seasonId}/tasks
POST   /api/v1/seasons/{seasonId}/tasks
PUT    /api/v1/tasks/{id}
POST   /api/v1/tasks/{id}/complete
POST   /api/v1/tasks/{id}/skip

GET    /api/v1/spaces/{spaceId}/grid
POST   /api/v1/spaces/{spaceId}/grid
DELETE /api/v1/spaces/{spaceId}/grid/{row}/{col}

GET    /api/v1/seasons/{seasonId}/summary
GET    /api/v1/seasons/{seasonId}/weekplan
GET    /api/v1/seasons/{seasonId}/schedule
POST   /api/v1/seasons/{seasonId}/autotasks
```

---

## Agent Integration

### Architecture

1. OpenAI `ChatClient` registered in DI via OpenAI SDK
2. `ChatClientAgent` (from `Microsoft.Agents.AI`) wraps it with system prompt + tools
3. **Function tools** registered via `AIFunctionFactory.Create()` from plugin classes
4. Plugin methods call the same `Tend.Application` services as REST controllers
5. Tools return JSON so the LLM can interpret and summarize naturally

### Streaming SSE Endpoint

`GET /api/v1/agent/chat` — SSE endpoint (requires auth)

Client sends messages, server streams agent responses as SSE events. Uses the AG-UI protocol via `MapAGUI()` for real-time streaming. The agent's tool calls and intermediate reasoning can be streamed to the client.

Request includes `sessionId` and `seasonId` as context. Conversation history is persisted in the `ConversationMessage` table, loaded per session.

### Plugin Classes (Tend.Agent/Plugins/)

| Plugin | Tools | Purpose |
|--------|-------|---------|
| GardenPlugin | ListGardens, GetGarden, ListSeasons, GetSeasonSummary | Navigation and context |
| PlantingPlugin | ListPlantings, GetPlanting, CreatePlanting, AdvanceStage, UpdateHealth, MovePlanting | Core planting operations |
| SpacePlugin | ListSpaces, GetSpaceGrid, CreateSpace | Space management |
| TaskPlugin | ListTasks, CreateTask, CompleteTask, SkipTask | Task management |
| PlanningPlugin | GetWeekPlan, GetPlantingSchedule, GenerateAutoTasks, SearchCatalog | **The agent's intelligence surface** |
| EventPlugin | ListRecentEvents, RecordObservation | Journal access |

### System Prompt

```
You are Tend, a garden management assistant. You help gardeners plan, track,
and manage their gardens through conversation.

You have tools to read and modify garden data. Always query data before
answering questions. Confirm destructive actions before executing.

Current context:
- User: {user.Email}
- Active season: {season.Name} ({season.Year})
- Last frost: {season.LastFrostDate}, First frost: {season.FirstFrostDate}
- Today: {today}

When suggesting next steps, consider target dates, frost windows, and
overdue tasks. Use GetWeekPlan for prioritization.
```

### Conversation Persistence

- `ConversationMessage` table: session_id, user_id, role (system/user/assistant/tool), content, created_at
- Loaded per session on each request
- Sliding window: keep last 30 messages, summarize older ones to stay within token limits

### Shared Service Layer

```
REST Controllers ──┐
                    ├──> Application Services ──> EF Core / PostgreSQL
Agent Plugins ─────┘
        ↑
  Both get ICurrentUserService injected
  Both enforce same business rules
```

---

## Implementation Order

1. **Tend.Domain** — entities, enums
2. **Tend.Infrastructure** — TendDbContext, entity configs, initial migration
3. **Tend.Application** — service interfaces + implementations, DTOs, auth service
4. **Tend.Api** — auth middleware, REST controllers, Program.cs with DI
5. **Tend.Agent** — plugins, agent factory, SSE endpoint
6. **Tests** — service layer tests, integration tests

## Verification

- Run EF Core migration against local PostgreSQL
- Register a user, get JWT, hit REST endpoints
- Create garden → season → spaces → plantings via REST
- Test stage transitions create events automatically
- Test week plan and schedule computed views
- Connect to SSE agent endpoint, ask "what should I do this week?" and verify it calls GetWeekPlan tool
- Test auto-task generation is idempotent
- Test multi-user isolation (user A can't see user B's gardens)

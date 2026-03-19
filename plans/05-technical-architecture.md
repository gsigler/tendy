# 05 — Technical Architecture

[← Back to Plan Index](README.md)

---

## Agent-First API Design

The public API surface is minimal. Internal tool APIs are consumed by agents, not humans.

### Public Endpoints (user-facing)

```
POST /api/v1/chat                       — Send message, receive SSE stream (AG-UI)
POST /api/v1/chat/sessions              — Create new conversation session
GET  /api/v1/chat/sessions              — List user's sessions
GET  /api/v1/chat/sessions/{id}         — Get session with message history

POST /api/v1/photos                     — Upload photo (triggers Observation Agent)
GET  /api/v1/photos/{id}                — Get photo + observations

GET  /api/v1/notifications              — Get user's notifications
PUT  /api/v1/notifications/{id}/read    — Mark notification read

POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/refresh
```

### Internal Tool APIs

NOT HTTP endpoints. C# methods that agents call directly in-process:

```csharp
public class GardenTools
{
    [KernelFunction, Description("List all gardens for the current user")]
    public async Task<IReadOnlyList<GardenDto>> ListGardens() { ... }

    [KernelFunction, Description("Get season summary with spaces, plantings, and task counts")]
    public async Task<SeasonSummaryDto> GetSeasonSummary(Guid seasonId) { ... }
}

public class PlantingTools
{
    [KernelFunction, Description("Create a new planting. Returns the created planting with ID.")]
    public async Task<PlantingDto> CreatePlanting(
        Guid seasonId, string crop, string? variety = null,
        string? spaceName = null, string sourceType = "seed", ...) { ... }

    [KernelFunction, Description("Advance a planting to the next growth stage")]
    public async Task<PlantingDto> AdvanceStage(Guid plantingId, string newStage) { ... }
}
```

---

## AG-UI Streaming Protocol

The chat endpoint streams events that the client renders progressively:

```
TEXT_MESSAGE_START       — Agent begins a text response
TEXT_MESSAGE_CONTENT     — Incremental text token
TEXT_MESSAGE_END         — Text response complete
TOOL_CALL_START          — Agent decides to call a tool (shows "Checking your garden...")
TOOL_CALL_ARGS           — Streaming tool call arguments
TOOL_CALL_END            — Tool call complete
TOOL_RESULT              — Result of tool execution
STATE_SNAPSHOT           — Current agent state (for reconnection)
RUN_STARTED / FINISHED   — Agent run lifecycle
RUN_ERROR                — Agent run failed
```

---

## LLM Strategy

### Provider Abstraction

Thin wrapper, not locked to OpenAI:

```csharp
public interface ILlmClient
{
    IAsyncEnumerable<StreamingChatCompletionUpdate> CompleteStreamingAsync(
        IReadOnlyList<ChatMessage> messages,
        ChatCompletionOptions options,
        CancellationToken ct = default);
}

public interface ILlmClientFactory
{
    ILlmClient GetClient(AgentType agentType);
}
```

### Model Routing Per Agent

| Agent | Model | Max Tokens | Temperature | Use Case |
|-------|-------|-----------|-------------|----------|
| Chat | gpt-4o | 4096 | 0.7 | Complex queries, planning, conversation |
| Planning | gpt-4o-mini | 2048 | 0.3 | Schedule analysis, task generation |
| Observation | gpt-4o (vision) | 1024 | 0.2 | Photo analysis |
| Notification | gpt-4o-mini | 256 | 0.1 | Yes/no decisioning |

### Token Budget Enforcement

Per-user daily limits per agent type, enforced at the `ILlmClient` wrapper level. Prevents runaway costs from any single user or agent.

### Prompt Versioning

System prompts stored as versioned files, not hardcoded:

```
src/Tend.Agent/Prompts/
  ChatAgent/v1.md
  PlanningAgent/v1.md
  ObservationAgent/v1.md
  NotificationAgent/v1.md
```

---

## Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Runtime | .NET 8 LTS | Mature, high-performance, great async/streaming support |
| Web | ASP.NET Core Minimal APIs | Thin public surface, no controller ceremony needed |
| Database | PostgreSQL + EF Core + Npgsql | jsonb for events, text[] for tags, LISTEN/NOTIFY for triggers |
| Agent Framework | Semantic Kernel for `[KernelFunction]` tool registration + OpenAI SDK for direct streaming calls | SK provides mature attribute-based tool discovery; direct SDK gives full control over streaming and tool dispatch. NOT using Microsoft Agent Framework (`Microsoft.Agents.AI`) — too immature. |
| Background Jobs | Hangfire + PostgreSQL storage | Persistent, retryable, dashboardable. Cron for schedules. |
| Image Processing | ImageSharp | Thumbnails. Plant analysis is the LLM's job via vision API. |
| Weather | Open-Meteo (free, no API key) | Cached 2x/day per user location |
| Auth | JWT bearer tokens | Standard ASP.NET Core identity pattern |

---

## Solution Structure

```
Tend.sln
├── src/
│   ├── Tend.Domain/              # Pure domain: entities, enums, interfaces
│   │   ├── Entities/             # User, Garden, Season, Space, Planting, CatalogEntry,
│   │   │                         # CatalogReview, Event, GridPlacement, Task,
│   │   │                         # ConversationSession, ConversationMessage, AgentRun,
│   │   │                         # AgentRecommendation, AgentMemory, Notification,
│   │   │                         # Photo, WeatherCache, TokenUsage
│   │   ├── Enums/
│   │   └── Interfaces/
│   │
│   ├── Tend.Application/         # Business logic, DTOs, computed views
│   │   ├── Services/             # PlantingService, PlanningService, ScheduleEngine,
│   │   │                         # ConversationService, TokenBudgetService,
│   │   │                         # AgentMemoryService, PhotoService, WeatherService,
│   │   │                         # NotificationService
│   │   ├── Models/               # DTOs — separate slim tool-response DTOs for agents
│   │   └── Auth/
│   │
│   ├── Tend.Infrastructure/      # EF Core, LLM clients, external services
│   │   ├── Data/
│   │   │   ├── TendDbContext.cs
│   │   │   └── Configurations/
│   │   ├── LLM/
│   │   │   ├── OpenAiLlmClient.cs
│   │   │   ├── BudgetedLlmClient.cs
│   │   │   └── LlmClientFactory.cs
│   │   ├── Weather/
│   │   │   └── OpenMeteoWeatherService.cs
│   │   └── Storage/
│   │       └── LocalFileStorage.cs
│   │
│   ├── Tend.Agent/               # Agent layer — THE core of the product
│   │   ├── Tools/                # GardenTools, PlantingTools, SpaceTools,
│   │   │                         # TaskTools, PlanningTools, EventTools,
│   │   │                         # MemoryTools, WeatherTools, PhotoTools
│   │   ├── Agents/
│   │   │   ├── ChatAgentFactory.cs
│   │   │   ├── PlanningAgentFactory.cs
│   │   │   ├── ObservationAgentFactory.cs
│   │   │   └── NotificationAgentFactory.cs
│   │   ├── Prompts/              # Versioned system prompts per agent
│   │   ├── Background/
│   │   │   ├── PlanningAgentJob.cs
│   │   │   ├── NotificationAgentJob.cs
│   │   │   ├── WeatherFetchJob.cs
│   │   │   └── EventListenerService.cs
│   │   └── Infrastructure/
│   │       ├── AgentCircuitBreaker.cs
│   │       └── AgUiMapper.cs
│   │
│   └── Tend.Api/                 # ASP.NET Core host (composition root)
│       ├── Endpoints/            # ChatEndpoints, PhotoEndpoints,
│       │                         # NotificationEndpoints, AuthEndpoints
│       └── Program.cs
│
└── tests/
    ├── Tend.Application.Tests/
    ├── Tend.Agent.Tests/
    │   ├── ToolTests/            # Test tools with mock services
    │   └── PromptTests/          # Test prompt rendering
    └── Tend.Api.Tests/           # Integration tests with WebApplicationFactory
```

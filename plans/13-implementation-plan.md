# 13 — Phased Implementation Plan

[← Back to Plan Index](README.md)

---

## Phase 0: Foundation (Week 1-2)

**Goal:** Get the agent talking to real garden data through tool calls.

**Deliverables:**
- `Tend.Domain` — all entities, enums, interfaces
- `Tend.Infrastructure` — TendDbContext, entity configs, initial migration, PostgreSQL in Docker
- `Tend.Application` — GardenService, PlantingService, SpaceService with DTOs. Auth with JWT (hardcoded test user OK)
- `Tend.Agent` — GardenTools (ListGardens, GetSeasonSummary) and PlantingTools (ListPlantings, GetPlanting) wired to services
- `Tend.Api` — SSE chat endpoint via AG-UI, auth middleware, seed data command
- Seed database with realistic garden data

**Success Criteria:**
- "What's in my garden?" -> agent calls ListPlantings, returns real PostgreSQL data
- Tool calls complete in <2s, streaming starts within 500ms
- Agent refuses out-of-scope questions appropriately

**Decision Gate:** Tool-call success rate <90% on 50-query test suite -> evaluate Semantic Kernel or raw OpenAI SDK.

---

## Phase 1: Core Agent (Week 3-6)

**Goal:** Complete garden management through conversation. The MVP that proves the thesis.

**Deliverables:**
- All remaining tools: Space, Task, Event, Catalog, Planning plugins
- Conversation persistence with sliding window
- Confirmation flow for destructive actions
- Error handling and disambiguation
- Full system prompt (from [07 — System Prompt](07-system-prompt.md))
- 30+ integration tests

**Success Criteria:**
- Complete workflow via chat: create planting -> assign space -> advance stages -> log observations
- Agent handles ambiguity correctly
- Conversation persists across sessions
- 95%+ tool-call success on 100-query test suite

**Decision Gate:** Recruit 3-5 gardener beta testers. If >50% prefer forms over chat for basic operations -> pivot to agent-as-assistant with traditional UI primary.

---

## Phase 2: Intelligence (Week 7-10)

**Goal:** The agent becomes genuinely useful — not just chat-based CRUD.

**Deliverables:**
- ScheduleEngine — deterministic date computation from frost dates + catalog data
- WeekPlan, PlantingSchedule, SeasonSummary computed views (as efficient SQL, not in-memory filtering)
- Auto-task generation (idempotent, background job)
- Agent memory tools (RememberFact, RecallFacts)
- Rich chat UI elements (grid visualization, task cards, schedule timeline)

**Success Criteria:**
- "What should I do this week?" returns actionable, data-grounded plan
- Agent never invents dates — all from ScheduleEngine
- Auto-tasks match expected output from existing CLI logic

**Decision Gate:** Beta tester daily usage <3 sessions/week during growing season -> intelligence layer not compelling enough.

---

## Phase 3: Autonomy (Week 11-16)

**Goal:** The agent reaches out to YOU. The "wow, this is different" moment.

**Deliverables:**
- Weather integration (Open-Meteo, cached)
- Proactive notifications (frost alerts, schedule reminders, health check prompts)
- Photo observation (upload -> vision analysis -> structured observation)
- Planning Agent (background, writes recommendations)
- Notification Agent (background, decides what to send)
- Token usage tracking and budget enforcement
- Agent execution logging (agent_runs table)

**Success Criteria:**
- Frost warning notification 24 hours before event
- Photo analysis creates useful observation >70% of the time
- Proactive suggestion accuracy >80% (measured by dismissal rate)
- LLM costs <$3/user/month at moderate usage
- Background agents <$0.20/user/month

**Decision Gate:** Notification open rates <20% or disable rate >40% -> scale back proactive features.

---

## Phase 4: Polish & Scale (Week 17+)

**Goal:** Production-ready public launch.

**Deliverables:**
- Full registration/onboarding flow
- Subscription billing (Stripe)
- Mobile-responsive web chat UI with rich elements
- Rate limiting, abuse prevention
- Observability (structured logging, OpenTelemetry, error tracking)
- Performance optimization

**Success Criteria:**
- Signup to first planting <5 minutes via agent onboarding
- P95 response latency <3s
- 100 concurrent users with <5% error rate
- Free-to-paid conversion >5%

---

## Visual Timeline

```
Week  1  2  3  4  5  6  7  8  9  10  11  12  13  14  15  16  17+
      ├──────┤                                                      Phase 0: Foundation
               ├──────────────┤                                     Phase 1: Core Agent
                               ├──────────────┤                     Phase 2: Intelligence
                                               ├──────────────────┤ Phase 3: Autonomy
                                                                    Phase 4: Polish
      ▲        ▲               ▲               ▲
      Spike 1  Gate 1         Gate 2          Gate 3
      & 4      (beta testers) (usage data)    (notification data)
```

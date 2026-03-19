# 04 — Agent Topology

[← Back to Plan Index](README.md)

---

Four agents with distinct roles, models, and trust levels. They coordinate through shared database state — no direct agent-to-agent communication.

```
                         ┌─────────────────┐
                         │   PostgreSQL     │
                         │                  │
   User ──► Chat Agent ──┤  Gardens         │
                         │  Plantings       │◄── Planning Agent (background)
   Photo ─► Observation  │  Tasks           │
             Agent ──────┤  Events          │◄── Notification Agent (background)
                         │  Recommendations │
                         │  Agent Memory    │
                         │  Conversations   │
                         │  Agent Runs      │
                         └─────────────────┘
```

---

## Chat Agent (User-facing)

- **Role:** Primary interface. Handles natural language, calls tools, streams responses via SSE.
- **Model:** Most capable (GPT-4o or equivalent). Highest token budget.
- **Access:** Full read/write to all tools.
- **Execution:** Synchronous within request/response, streamed via AG-UI protocol.

---

## Planning Agent (Autonomous background)

- **Role:** Monitors conditions (weather, frost dates, growth stages) and generates recommendations, adjusts schedules, creates tasks.
- **Model:** Mid-tier (GPT-4o-mini). Lower token budget.
- **Access:** Read all garden data. Write to tasks, recommendations, events.
- **Execution:** Runs on schedule (every 6 hours) and on triggers (weather alerts, stage changes).
- **Key constraint:** Writes `AgentRecommendation` records, does NOT directly message users. High-confidence actions (target date has passed -> create task) auto-execute. Low-confidence actions require user confirmation.

---

## Observation Agent (Photo processing)

- **Role:** Processes uploaded photos. Identifies plants, assesses health, detects issues, logs structured observations.
- **Model:** Vision-capable (GPT-4o). Limited budget per image.
- **Access:** Read plantings/catalog. Write events and planting health.
- **Execution:** Triggered by photo upload. Sets health to `Watch` at most — never directly to `Diseased` or `Dead`.
- **Key constraint:** Positioned as "observations and suggestions" not "diagnosis."

---

## Notification Agent (Alert decisioning)

- **Role:** Decides whether pending recommendations, weather alerts, and overdue tasks warrant user notification. The "should I bother the user?" agent.
- **Model:** Cheapest/fastest (GPT-4o-mini). Minimal budget.
- **Access:** Read-only garden data, recommendations, notification history. Write to `Notification` table only.
- **Execution:** Runs hourly during user's active hours (9am-9pm local). Considers notification history, severity, time sensitivity, user preferences.

---

## Coordination Model

Agents communicate through **shared database state**, not message passing:
- Planning Agent writes `AgentRecommendation` records
- Notification Agent reads recommendations + other triggers -> writes `Notification` records
- Chat Agent reads recommendations when answering "what should I do?" questions

This is deliberately simple: debuggable, naturally idempotent, and the database is the single source of truth.

**Event-driven triggers** via PostgreSQL `LISTEN/NOTIFY` for real-time events (photo uploaded, weather alert) and Hangfire for time-based triggers (daily planning, hourly notification checks).

| Trigger | Mechanism | Agent |
|---------|-----------|-------|
| Every 6 hours | Hangfire recurring job | Planning Agent |
| Weather alert received | PostgreSQL NOTIFY -> Channel listener | Planning Agent |
| Photo uploaded | Direct invocation from upload endpoint | Observation Agent |
| Every hour (9am-9pm user local time) | Hangfire recurring job | Notification Agent |
| Planting stage changed | EF Core SaveChanges interceptor -> event | Planning Agent (re-evaluate schedule) |

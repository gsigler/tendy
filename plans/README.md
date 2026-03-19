# Tend — Agent-First Garden Management Platform

> **Thesis:** Traditional garden apps require endless manual data entry, forms, and clicks. Tend eliminates all of that. The AI agent IS the product — users talk, the agent manages. Background agents work autonomously to monitor weather, adjust schedules, and proactively alert. This is not "garden app + chatbot." This is a fundamentally different paradigm: **you garden, Tend manages.**

---

## Plan Documents

### Product & Market

| Document | Description |
|----------|-------------|
| [01 — Vision & Market Fit](01-vision-and-market-fit.md) | The problem, the 10x argument, competitive landscape, defensibility |
| [02 — User Personas](02-user-personas.md) | 4 target personas: beginner, enthusiast, community coordinator, micro-farm |
| [10 — Monetization](10-monetization.md) | Pricing tiers (Free -> $29.99/mo), additional revenue streams |
| [12 — Cost Model](12-cost-model.md) | Per-turn token estimates, monthly costs per user, break-even, budget enforcement |

### Agent Experience & UX

| Document | Description |
|----------|-------------|
| [03 — Agent Experience](03-agent-experience.md) | Onboarding conversation, daily interaction patterns, photo/harvest/planning flows |
| [07 — System Prompt](07-system-prompt.md) | Full system prompt: persona, rules, complete tool guide (~25 tools), lifecycle, disambiguation |
| [08 — Rich Chat UI](08-rich-chat-ui.md) | Structured JSON elements: grids, timelines, task cards, weather, confirmations |
| [09 — Proactive Behaviors](09-proactive-behaviors.md) | Weather alerts, schedule reminders, health checks, season transitions, notification control |
| [16 — Failure Modes](16-failure-modes.md) | LLM down fallback, correction/undo flows, disambiguation, notification frequency |
| [17 — UX/UI Flows](17-ux-ui-flows.md) | ASCII wireframes: navigation architecture, screen layouts, all message types, user flows, responsive design, fallback states |

### Technical Architecture

| Document | Description |
|----------|-------------|
| [04 — Agent Topology](04-agent-topology.md) | 4 agents (Chat, Planning, Observation, Notification), coordination model, triggers |
| [05 — Technical Architecture](05-technical-architecture.md) | API design (8 public endpoints), AG-UI streaming, LLM strategy, Semantic Kernel + OpenAI SDK, solution structure |
| [06 — Data Architecture](06-data-architecture.md) | 19 tables (10 core + 9 agent) with SQL schemas, indexes, design decisions |

### Planning & Risk

| Document | Description |
|----------|-------------|
| [11 — Risk Registry](11-risk-registry.md) | 10 risks scored by severity x likelihood with mitigations |
| [13 — Implementation Plan](13-implementation-plan.md) | 4 phases (17+ weeks) with deliverables, success criteria, decision gates |
| [14 — Technical Spikes](14-technical-spikes.md) | 5 experiments to validate before committing |
| [15 — Kill Criteria](15-kill-criteria.md) | When to pivot, scale back, or kill the project |

### Reference

| Document | Description |
|----------|-------------|
| [Appendix — Changes from Original Plan](appendix-changes.md) | Key differences from the initial architecture plan |
| [Original Architecture Plan](agent-first-architecture.md) | The initial C# API architecture plan (superseded) |

---

## Reading Order

**For product understanding:** 01 -> 02 -> 03 -> 17 -> 09 -> 10

**For technical depth:** 04 -> 05 -> 06 -> 07 -> 08

**For UX/UI design:** 17 -> 03 -> 08 -> 16 -> 09

**For project planning:** 13 -> 14 -> 11 -> 12 -> 15 -> 16

---

## Key Numbers

| Metric | Value |
|--------|-------|
| Public API endpoints | 8 (chat, photos, notifications, auth) |
| Agent types | 4 (Chat, Planning, Observation, Notification) |
| Database tables | 19 (10 core + 9 agent infrastructure) |
| Agent tools | ~25 across 9 tool classes |
| Blended cost per turn | $0.006 |
| Average cost per user/month | $2.06 |
| Break-even (infra) | 9 paying users |
| Ramen profitability | ~850 paying users at $7.99/mo |
| Implementation phases | 4 (17+ weeks) |
| Technical spikes | 5 (weeks 1-4) |

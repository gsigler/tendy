# 11 — Risk Registry

[← Back to Plan Index](README.md)

---

## Top Risks by Severity x Likelihood

| # | Risk | Score | Mitigation |
|---|------|-------|------------|
| 1 | **Feature creep from "agent can do anything"** — users ask about pest ID, soil chemistry, fertilizer brands. Agent happily hallucinates. | 20 | Define explicit capability boundaries in system prompt. Agent only answers questions it can ground in user data or tool results. |
| 2 | **Autonomous agent runaway costs** — background agents polling and making LLM calls blow through budget. | 16 | Hard per-user daily token budgets. Background agents use gpt-4o-mini (30x cheaper). Weather checks 2x/day, cached. Circuit breaker at 30% error rate. Global kill switch. |
| 3 | **Users don't trust AI with their garden** — wrong planting dates = lost season. | 16 | Agent NEVER calculates dates itself — reads from deterministic ScheduleEngine. Always shows reasoning. Confirms destructive actions. |
| 4 | **Chat slower than forms for simple tasks** — "mark tomatoes as transplanted" is slower to type than clicking a button. | 16 | Rich chat UI with quick-action buttons. Agent responses include "want me to do X too?" shortcuts. Track chat vs. button usage to validate. |
| 5 | **LLM reliability for garden-critical advice** — wrong advice has real consequences. | 15 | Planting dates computed deterministically, never by LLM reasoning. System prompt: "Never suggest dates you calculated yourself." |
| 6 | **Cold-start problem** — new user has no data, agent has nothing to work with. | 15 | Conversational onboarding flow. Catalog templates by zone. Bulk import from seed orders. |
| 7 | **LLM costs vs. subscription revenue** — heavy users could cost $3-8/month in API calls. | 15 | Model routing (70% mini, 30% full). Service-layer caching. Target <$2/user/month average. |
| 8 | **Seasonal usage patterns** — intense spring/summer, dead winter. | 15 | Annual subscriptions. Winter features (catalog review, next-season planning, seed ordering). |
| 9 | **Agent framework maturity/lock-in** | 12 | Agent plugins are thin wrappers over Application services. Replacing framework = rewriting AgentFactory, not business logic. |
| 10 | **Photo analysis accuracy** — GPT-4o Vision useful but not a plant pathologist. | 12 | Positioned as "observations and suggestions." Sets health to Watch, never Dead. Spike with 50 photos before committing. |

---

## Risk Scoring

Each risk is scored as **Severity (1-5) x Likelihood (1-5)**.

| Score Range | Action |
|-------------|--------|
| 16-25 | Must mitigate before building. Active monitoring. |
| 10-15 | Mitigate during implementation. Decision gates. |
| 5-9 | Accept with monitoring. Address if escalated. |
| 1-4 | Accept. |

---

## The Three Highest Risks Are Product Risks

The hardest part is not building the agent but **validating that users want it**:

1. Feature creep (score 20) — users will expect the agent to know everything
2. Trust (score 16) — gardeners need to trust AI with their season
3. Chat vs. forms (score 16) — chat may be wrong for simple CRUD

The Phase 1 decision gate (beta testers choosing chat vs. forms) is the single most important milestone in the project.

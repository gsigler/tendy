# 12 — Cost Model

[← Back to Plan Index](README.md)

---

## Per-Turn Token Estimation

| Component | Input Tokens | Output Tokens |
|-----------|-------------|---------------|
| System prompt | ~1,000 | — |
| Tool definitions (~25 tools) | ~3,000 | — |
| Conversation history (avg 8 turns) | ~2,000 | — |
| User message | ~50 | — |
| Tool call + result | ~500 | ~100 |
| Final response | — | ~200 |
| **Total per turn** | **~6,550** | **~300** |

---

## Cost Per Turn

| Model | Input $/1M | Output $/1M | Cost/Turn |
|-------|-----------|-------------|-----------|
| gpt-4o | $2.50 | $10.00 | $0.019 |
| gpt-4o-mini | $0.15 | $0.60 | $0.001 |

**Blended cost** (30% gpt-4o, 70% gpt-4o-mini): **$0.006/turn**

---

## Monthly Cost Per User

| Usage Level | Turns/Month | Chat Cost | Background Agents | Total |
|-------------|-------------|-----------|-------------------|-------|
| Light (3-5/day) | 100 | $0.62 | $0.15 | **$0.77** |
| Moderate (8-15/day) | 350 | $2.17 | $0.15 | **$2.32** |
| Heavy (20-40/day) | 900 | $5.58 | $0.15 | **$5.73** |

Background agents: 60 weather checks/month (2/day) + 30 daily schedule scans + 4 weekly summary generations, all using gpt-4o-mini. ~25,000 input + 5,000 output tokens/month = ~$0.15/month.

---

## Break-Even (at $7.99/month subscription)

- Weighted average cost (50% light, 35% moderate, 15% heavy): **$2.06/user/month**
- Margin per user: **$5.93**
- Infrastructure: ~$50/month (hosting, DB, monitoring)
- Break-even on infra: **9 paying users**
- Ramen profitability ($5K/month): **~850 paying users**

---

## Cost Risks

| Scenario | Impact | Viable? |
|----------|--------|---------|
| Without model routing (100% gpt-4o) | Heavy user costs $16.20/month | **No** — model routing is not optional |
| OpenAI doubles prices | Moderate user cost -> $4.49/month | Yes, but thin margin |
| Token counts 50% higher than estimated | Add ~50% to all costs | Yes for light/moderate, tight for heavy |
| Provider switch to Anthropic/local models | Potentially lower costs | Yes — abstraction layer enables this |

---

## Token Budget Enforcement

When a user hits their daily token budget:

1. **Chat Agent:** Agent responds with a friendly message: "I've hit my thinking limit for today. You can still use quick-action buttons to complete tasks and log events. I'll be back at full capacity tomorrow." Quick-action buttons (task completion, skip) still work via REST.
2. **Background Agents:** Stop running for that user until the next day. No notifications generated.
3. **Free Tier:** Background agents (Planning, Notification) do NOT run. Weather checks are shared/cached. 20 messages/day enforced at the API layer — after 20, the free-tier fallback UI is shown.

Daily budgets per tier:

| Tier | Chat Agent | Background Agents | Photo Analysis |
|------|-----------|-------------------|---------------|
| Seedling (Free) | 20 msgs/day (mini only) | None | None |
| Grower ($7.99) | 100k tokens/day | 20k tokens/day | 5 photos/day |
| Cultivator ($14.99) | 200k tokens/day | 40k tokens/day | 15 photos/day |
| Steward ($29.99) | 500k tokens/day | 100k tokens/day | 30 photos/day |

---

## Revenue Projections

| Paying Users | Monthly Revenue | Monthly LLM Cost | Monthly Infra | Monthly Profit |
|-------------|----------------|-------------------|---------------|----------------|
| 50 | $400 | $103 | $50 | $247 |
| 250 | $2,000 | $515 | $75 | $1,410 |
| 850 | $6,792 | $1,751 | $150 | $4,891 |
| 2,000 | $15,980 | $4,120 | $300 | $11,560 |

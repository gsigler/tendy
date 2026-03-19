# 15 — Kill Criteria

[← Back to Plan Index](README.md)

---

## Kill the Agent-First Approach If:

- Tool-call accuracy <85% on standardized 100-query test after 2 weeks of prompt engineering
- Agent gives harmful garden advice (wrong frost dates, toxic plant misidentification) >1% of the time
- Beta testers report "agent got it wrong" >10% of interactions

**Pivot to:** Agent-as-assistant with traditional form UI primary. Domain model, services, and all business logic fully reusable.

---

## Kill the Current Pricing Model If:

- Average LLM cost >$5/user/month at moderate usage
- Background agent costs >$0.50/user/month
- Total costs >70% of revenue after 100 paying users

**Pivot to:** Aggressive model-routing, fine-tuned small model for common ops, or raise subscription price.

---

## Kill the Chat-Primary Interface If:

- >60% of CRUD operations happen via quick-action buttons rather than chat after 30 days of both options
- Daily active usage <3 sessions/week during growing season
- Beta testers' #1 feedback is "I wish I could just click a button"

**Pivot to:** Traditional UI with agent sidebar for planning and complex queries.

---

## Kill the Entire Project If:

- After Phase 1: <2 of 5 beta testers would pay $5+/month
- After Phase 2: "What should I do this week?" not rated "very useful" by >60% of testers
- LLM pricing rises to require >$20/month subscription for viability

---

## Kill Criteria for Specific Technologies

| Technology | Kill Signal | Alternative |
|-----------|------------|-------------|
| Microsoft Agent Framework | Framework bugs block shipping for >2 weeks | Raw OpenAI function-calling (2-3 day migration) |
| SSE Streaming / AG-UI | Protocol proves unstable or poorly documented | Simple request/response with polling |
| OpenAI API | >4 hours downtime/month or API deprecation with <3 months notice | Anthropic Claude as fallback provider |
| Photo Analysis (GPT-4o Vision) | <50% useful responses in Spike 2 | Drop feature from MVP, revisit with future models |

---

## Decision Gate Summary

| Gate | When | Question | Pass | Fail Action |
|------|------|----------|------|-------------|
| Spike 1 | Week 1 | Can tool-calling work? | >90% accuracy | Evaluate alternative frameworks |
| Phase 0 | Week 2 | Does the stack work end-to-end? | Agent talks to real DB | Reassess architecture |
| Phase 1 | Week 6 | Do users want chat-first? | >50% prefer chat for complex ops | Pivot to agent-as-assistant |
| Phase 2 | Week 10 | Is the intelligence compelling? | >3 sessions/week during season | Add more intelligence or pivot |
| Phase 3 | Week 16 | Do proactive features add value? | >20% notification open rate | Scale back autonomous agents |

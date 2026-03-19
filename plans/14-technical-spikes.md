# 14 — Technical Spikes

[← Back to Plan Index](README.md)

---

Run in weeks 1-4 before committing to significant implementation.

## Spike 1: Tool-Call Reliability (Week 1, 2 days)

**Question:** Can the agent reliably route natural language to correct tools with correct parameters?

**Experiment:** Create a minimal agent with 5 tools (ListPlantings, CreatePlanting, AdvanceStage, GetWeekPlan, SearchCatalog) backed by an in-memory data store. Write 50 test queries covering: simple lookups, create operations, ambiguous references, multi-step sequences, edge cases (empty results, invalid inputs). Run each query 3x to test consistency.

**Pass:** >90% single-tool accuracy, >75% multi-step.

**Kill:** <80% single-tool -> evaluate Semantic Kernel or raw OpenAI function-calling.

---

## Spike 2: Photo Health Assessment (Week 2, 1 day)

**Question:** Is GPT-4o Vision useful enough for garden observations?

**Experiment:** Collect 50 real garden photos from Reddit r/gardening, gardening forums (mix of healthy, pest issues, nutrient deficiency, disease). Send each to GPT-4o Vision with prompt: "Describe what you see in this garden photo. Identify the plant if possible. Note any health concerns." Have 2 gardeners rate each response: Useful / Partially Useful / Not Useful.

**Pass:** >70% Useful + Partially Useful. Cost <$0.03/image.

**Kill:** <50% useful -> drop photo feature from MVP.

---

## Spike 3: Weather-Reactive Alerts (Week 3, 1 day)

**Question:** Can we generate genuinely useful proactive alerts?

**Experiment:** Get 30 days of historical weather data for a test location. Create test scenarios: frost events, heat waves, extended rain, first warm spell of spring. For each scenario, given a realistic garden state (plantings at various stages), generate alerts using gpt-4o-mini. Have gardeners rate: Would Act On / Interesting / Noise.

**Pass:** >60% "Would Act On" for frost/heat. >40% for other events.

**Kill:** <40% overall -> weather becomes info-only, no proactive alerts.

---

## Spike 4: Streaming UX Performance (Week 1, 1 day)

**Question:** Does SSE streaming feel responsive enough when tool calls add latency?

**Experiment:** Implement the SSE endpoint with AG-UI protocol. Measure: time to first token, total response time for (a) simple listing query, (b) tool-calling query, (c) multi-tool query. Test on 3G-throttled connection to simulate mobile.

**Pass:** First token <500ms simple, <2s tool-calling. Total <5s typical.

**Kill:** First token consistently >3s -> fall back to request/response with loading states.

---

## Spike 5: Background Agent Cost Control (Week 4, 1 day)

**Question:** Can background agents stay under $0.20/user/month while being useful?

**Experiment:** Simulate 30 days of background processing for one user: 2 weather checks/day, 1 schedule scan/day, 1 weekly summary. Log all tokens consumed. Evaluate quality of generated tasks and notifications.

**Pass:** <$0.20/month, >80% generated tasks relevant.

**Kill:** >$0.50/month or <50% relevance -> background agents become deterministic logic, LLM only for text generation.

---

## Spike Priority and Dependencies

```
Week 1:  Spike 1 (tool-call reliability) ← PREREQUISITE for everything
         Spike 4 (streaming UX) ← parallel, independent

Week 2:  Spike 2 (photo assessment) ← independent

Week 3:  Spike 3 (weather alerts) ← needs garden data from Phase 0

Week 4:  Spike 5 (background costs) ← needs agent infrastructure from Phase 0
```

If Spike 1 fails, the rest of the plan needs fundamental revision.

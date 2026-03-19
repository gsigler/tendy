# Appendix — Key Differences from Original Architecture Plan

[← Back to Plan Index](README.md)

---

| Original Plan | This Plan | Rationale |
|--------------|-----------|-----------|
| 46 REST endpoints as primary API surface | 8 public endpoints; CRUD is agent-internal | Agent IS the product |
| Microsoft Agent Framework (`Microsoft.Agents.AI`) | Semantic Kernel `[KernelFunction]` for tool registration + OpenAI SDK direct for streaming | SK is more mature, better documented, larger community. Direct SDK gives full streaming control. |
| Random GUIDs for PKs | UUIDv7 (time-ordered) | Prevents B-tree fragmentation on append-heavy tables |
| 10 database tables | 19 tables (10 core + 9 agent: sessions, messages, agent_runs, recommendations, memory, notifications, photos, weather_cache, token_usage) | Agent infrastructure needs its own data layer |
| 12-line system prompt | ~100-line comprehensive prompt with tool guide, lifecycle docs, behavioral rules | Agent quality depends entirely on prompt quality |
| No background agents | 4 distinct agents (Chat, Planning, Observation, Notification) | Autonomous behavior is the differentiator |
| No weather integration | Open-Meteo with caching | Weather-reactive advice is a killer feature |
| No photo support | Photo upload + vision-based observation | Multimodal is expected in 2026 |
| No cost modeling | Detailed per-turn, per-user, break-even analysis | Must prove business model viability |
| No phased rollout | 4 phases with decision gates and kill criteria | Validate thesis before building everything |
| In-memory computed views | Efficient SQL queries | CLI's load-everything-filter-in-memory won't scale |
| Comma-separated tags | PostgreSQL text[] with GIN index | Native array operations |
| Loose session_id string | ConversationSession table with metadata | Enables session listing, cleanup, season association |
| No user personas or market research | 4 personas, competitive landscape, $1.2B market analysis | Product decisions need user context |
| No monetization strategy | 4-tier pricing ($0 to $29.99/mo) with break-even analysis | Business viability must be designed, not assumed |
| No failure mode design | LLM fallback, correction flows, undo patterns, disambiguation | Failure UX is as important as happy-path UX |

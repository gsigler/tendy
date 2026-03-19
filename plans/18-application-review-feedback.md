# 18 — Application Review Feedback

[← Back to Plan Index](README.md)

---

## What's Been Done Exceptionally Well

The planning is among the best for a solo/small-team project. The 20-document structure with reading orders, key metrics, kill criteria, and decision gates shows real discipline. Specifically:

- **Kill criteria (doc 15) and decision gates** are rare in indie projects and will save you from sunk-cost fallacy
- **Cost model (doc 12)** with blended per-turn estimates and budget enforcement tiers is thorough
- **Failure modes (doc 16)** — the correction/undo flows and LLM-down fallback show you've thought about the unhappy paths
- **Risk registry (doc 11)** correctly identifies that the top 3 risks are product risks, not technical ones
- **Agent topology (doc 04)** — separating 4 agents with different models/temperatures/budgets is smart cost engineering

---

## Gaps & Missing Pieces

### 1. No Frontend Technology Decision

ASCII wireframes (doc 17), rich chat UI specs (doc 08), and AG-UI streaming protocol (doc 05) exist, but **zero mention of what the frontend is built with**. This is a significant gap for a chat-first product where the UI *is* the product experience.

Questions to resolve:
- Web app? React/Next.js? Svelte? Blazor (staying in .NET)?
- Native mobile? React Native? Flutter? Or PWA?
- How will you render the structured JSON elements (garden grids, task cards, timelines)?
- Who builds the frontend? If it's just you, Blazor keeps you in one stack but limits hiring later.

### 2. No Offline / Poor Connectivity Story

Gardeners are literally outside in their gardens when they most need the app. Cell service in backyards, community gardens, and rural plots is often poor. The entire interaction model requires an LLM round-trip.

Consider:
- Offline-capable task list and planting view (cached locally)
- Queue messages for when connectivity returns
- The LLM-down fallback (doc 16) partially addresses this, but network issues are different from LLM outages

### 3. No Data Migration / Import Strategy

Doc 06 mentions "bulk import from seed orders" in passing (risk #6 mitigation), but there's no plan for:
- Importing from competing apps (Planta, GrowVeg, Gardenize) — this is a major acquisition lever
- CSV/spreadsheet import for users who track in Excel
- Seed catalog integration (Johnny's Seeds, Baker Creek, Burpee catalog data)
- How the catalog gets populated beyond manual entry — this is the same "manual data entry" problem you're solving

### 4. Multi-Device / Real-Time Sync Not Addressed

The architecture is server-first (good), but:
- What happens when a user has the app open on phone and tablet?
- Do notifications clear across devices when read on one?
- Does the conversation session update in real-time if a background agent writes a recommendation while the user is chatting?
- WebSocket or polling for non-chat updates?

### 5. No Search / History Navigation

Conversation sessions exist (doc 06) but no way to search across them. Gardeners will want to say "what did I plant last spring?" or "when did I transplant the tomatoes last year?" and the answer might be buried in conversation history.

Consider:
- Full-text search across conversation messages and events
- A structured timeline/journal view outside of chat
- Cross-season comparison views

### 6. User Onboarding for Non-Chat-Native Users

Personas include Sarah (overwhelmed beginner) who may not be comfortable with a chat-first interface. The onboarding flow (doc 03) is conversational, but:
- What if someone doesn't know what to type?
- Suggested prompts / conversation starters on empty states?
- A guided tutorial mode with example interactions?
- The system prompt (doc 07) coaches the agent, but the *user* also needs coaching

### 7. No API Rate Limiting or Abuse Prevention Details

Doc 13 Phase 4 mentions "rate limiting, abuse prevention" but this is deferred too late. Free tier with 20 messages/day is an abuse target from day one.

Missing specifics:
- How do you prevent bot signups burning free-tier LLM credits?
- CAPTCHA or email verification on registration?
- IP-based rate limiting before auth?
- What stops someone from creating 100 free accounts?

### 8. No Observability / Debugging Plan for Agent Behavior

The `agent_runs` table exists for logging, but no plan for:
- How do you debug why the agent gave bad advice to a specific user?
- Conversation replay tooling for investigating issues
- A/B testing prompt versions (versioned prompts exist, but no framework for comparing them)
- Metrics dashboards: tool-call success rates, hallucination detection, user satisfaction signals

### 9. Photo Storage & Privacy

Doc 06 has a `photos` table with `storage_key`, but:
- Where are photos stored? Local filesystem won't scale. S3? Azure Blob?
- Photos of people's gardens/homes have privacy implications — what's the retention policy?
- Are photos sent to OpenAI for vision analysis? Users should know this.
- EXIF data in photos contains GPS coordinates — strip or use?

### 10. No Conversation Memory Management Strategy

The system prompt mentions "sliding window" for conversation context, but:
- How do you summarize older messages to stay within token limits?
- What's the window size? 8 turns? 20?
- How do you handle conversations that reference things from 50 messages ago?
- The `summary` field on `conversation_sessions` suggests compression, but no algorithm/approach is specified

### 11. Seasonal Business Model Risk Is Underexplored

Risk #8 mentions "annual subscriptions" and "winter features" but this deserves deeper treatment:
- Monthly churn will be brutal in October-November as gardens wind down
- Annual pricing makes sense but lowers initial conversion (higher commitment)
- Consider: What's the November-February value proposition specifically? "Plan next season" is weak for 4 months of subscription payments
- Idea: Winter could be when the cross-garden intelligence and catalog review features shine

### 12. No Accessibility Plan

- Screen reader compatibility for the chat interface?
- Voice input for when users have dirty hands from gardening?
- High-contrast mode for outdoor use in bright sunlight?
- This is both an ethical consideration and a practical one — gardeners are often outdoors squinting at screens

### 13. Community Garden Tier (Steward) Is Underspecified

The $29.99/mo tier promises "multi-user workspace (50 plots), coordinator dashboard, member onboarding, volunteer scheduling, aggregate reporting" but none of these features appear in the data architecture or implementation plan. The schema has no concept of:
- Organizations or teams
- Roles / permissions beyond a single user
- Shared gardens or plot assignments
- Volunteer scheduling

This tier shouldn't be in the pricing table until it's at least architecturally scoped.

### 14. No GDPR / Data Deletion Story

The app stores learned facts about users, conversation history, photos, and location data. If a user wants to delete their account:
- Cascade delete all data? What about anonymized aggregate intelligence?
- Data export (GDPR portability)?
- Right to be forgotten vs. conversation history in shared sessions (future community tier)?

### 15. Testing Strategy Is Too Vague

"30+ integration tests" (Phase 1) is a number, not a strategy. What's missing:
- How do you test agent behavior? LLM responses are non-deterministic
- Snapshot testing for tool-call sequences?
- Regression suite for "the agent should never recommend X"
- Load testing for SSE streaming under concurrent users
- The technical spikes (doc 14) are great for validation, but there's no ongoing testing philosophy

---

## Prioritized Recommendations

The **5 things to address before writing code**:

1. **Choose your frontend stack** — this decision affects everything from hiring to iteration speed to the rich UI elements designed in docs 08 and 17
2. **Design the offline/poor-connectivity experience** — users are gardeners standing outside, not office workers at desks
3. **Scope down the Steward tier** — remove it from pricing until architecturally planned, or it becomes a promise you can't keep
4. **Add basic abuse prevention to Phase 0** — email verification, rate limiting, IP throttling — don't wait until Phase 4
5. **Define your conversation memory strategy** — sliding window + summary is the right approach, but the implementation details affect token costs (risk #2) and user experience fundamentally

---

## Overall Assessment

The vision is strong. The agent-first paradigm is genuinely differentiated, and the planning rigor gives a real shot at executing it. The gaps above are mostly "things that will bite you during implementation" rather than "fundamental flaws in the concept." The Phase 1 decision gate (do users actually prefer chat?) is exactly the right thing to validate first.

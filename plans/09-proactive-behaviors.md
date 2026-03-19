# 09 — Proactive Agent Behaviors

[← Back to Plan Index](README.md)

---

The agent doesn't just respond — it initiates. This is the core differentiator.

## Weather-Triggered Alerts

```
TEND: Frost advisory tonight — low of 31F expected.

      Your tender plants at risk:
      * Sun Gold tomato (Sunny Bed) — producing, PROTECT
      * Jalapeno (Sunny Bed) — producing, PROTECT
      * Basil (Patio) — producing, PROTECT

      Your cold-hardy plants should be fine:
      * Lettuce (Bed 2) — handles light frost

      I've added "Cover tender plants" to your evening tasks.
      [Mark Done] [Dismiss]
```

---

## Schedule-Based Reminders

```
TEND: Your lettuce seedlings are at day 21 since direct sowing.
      They should be ready for their first harvest of baby greens!

      Want me to log a harvest when you pick some?
```

---

## Health Check Prompts

```
TEND: It's been 12 days since you last checked on the peppers in
      Bed 2. At this stage (producing), a quick look every week helps
      catch issues early. How are they doing?
```

---

## Season Transition Guidance

```
TEND: It's August 15 — about 14 weeks until your first frost (Nov 28).
      This is a great time to plan fall planting! In Austin, you can
      still get in:
      * Lettuce, spinach, kale (direct sow now)
      * Broccoli, cauliflower (transplant in September)
      * Garlic (plant in October)

      Want me to plan a fall garden?
```

---

## Notification Frequency Control

Users configure via conversation:
- "Send me updates every morning"
- "Only alert me for urgent stuff like frost"
- "I don't want daily messages, just weekly summaries"

The Notification Agent respects these preferences, stored in `agent_memory` as user preferences.

### Default Frequency

| Category | Default | Options |
|----------|---------|---------|
| Weather alerts | Immediate | Immediate / Daily digest / Off |
| Task reminders | Daily | Daily / Weekly / Off |
| Health check prompts | Every 7 days | Every 7 / 14 / 30 days / Off |
| Season tips | As needed | As needed / Monthly / Off |

### How Proactive Messages Appear

1. **In-app:** Distinct visual style — slightly different background, clock icon, "Tend noticed..." prefix. Appears at the top of chat when the user opens the app.
2. **Push notifications:** Urgent items only (frost warnings, overdue tasks). Tapping opens the chat with the full message.
3. **Batching:** Non-urgent messages are batched into the morning check-in. Only urgent alerts get standalone notifications.

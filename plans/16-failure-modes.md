# 16 — Failure Modes & Graceful Degradation

[← Back to Plan Index](README.md)

---

## LLM is Down

The user sees a lightweight fallback that uses the REST API directly (no agent):

```
┌──────────────────────────────────────────┐
│  Tend is having trouble thinking right   │
│  now. Here's what I can still show you:  │
│                                          │
│  [Your Week Plan]     [Your Plantings]   │
│  [Open Tasks]         [Recent Events]    │
│                                          │
│  Trying again in 30 seconds...           │
└──────────────────────────────────────────┘
```

Week plan, task list, and planting list are pre-computed REST views — they work without the LLM. Quick-action buttons (complete task, log watering) still function. When the LLM recovers: "I'm back. Looks like you completed 3 tasks while I was away — nice work."

---

## Agent Misunderstands -> User Corrects

```
USER: I just transplanted the basil

TEND: Done — moved basil to "transplanted" stage.

USER: No wait, I moved the container to a sunnier spot, not transplanted

TEND: Got it — that's just a move, not a stage change. I've reverted basil
      back to "producing" and logged a note about the container move.
```

**Correction triggers:** "No," "wait," "I meant," "that's not right," "undo that" — all cause the agent to re-evaluate its last action. Corrections are logged as events too, maintaining the audit trail.

---

## Agent Makes a Mistake (Wrong Stage Transition)

```
USER: The zucchini is done

TEND: Marked zucchini as "finished." Great run — 12 harvests, ~15 lbs!

USER: I meant it's done fruiting for today, not done for the season!

TEND: Oh! Changed zucchini back to "producing." Still active and tracking.
```

The revert creates a StageChanged event (history shows: producing -> finished -> producing). Agent acknowledges concisely — no excessive apologizing.

---

## Destructive Action Protection

```
TEND: Remove the lettuce planting entirely? This will delete:
      - The planting record
      - 6 events (observations, harvests)
      - 2 completed tasks

      [Yes, delete it] [No, just mark it finished]
```

Confirmation cards prevent most destructive mistakes.

---

## Slow Response / Loading States

Streaming shows progress as tool calls execute:

```
Looking up your plantings...    done
Checking the weather...         done
Calculating this week's plan... working
```

If a tool call takes >3s, the agent continues with available info: "While I look that up, based on the date your seedlings should be about 3 weeks old now."

If total response >10s: "still working..." indicator with cancel option.

---

## User Pushback / Disambiguation

```
USER: How's the tomato doing?

TEND: Your Early Girl is looking good — producing stage, harvested ~1 lb last week.

USER: No, the other one — the Cherokee Purple

TEND: Cherokee Purple is behind — still transplanted, not fruiting yet. Normal
      for a 75-80 day variety. You transplanted May 1, expect fruit in 2-3 weeks.
      I'll be more specific next time — you can also say "the Cherokee" or
      "the purple one."
```

---

## Contradictory Information

```
USER: My cucumbers are producing like crazy

TEND: Great! But they're showing as "planned" stage. Did you sow them and
      forget to tell me? When was that, roughly?

USER: Oh yeah, about 6 weeks ago

TEND: Updated — cucumbers now "producing," started ~Feb 5.
      I'll backfill the stage history. Just let me know when things happen
      going forward.
```

---

## Notification Frequency Control (via conversation)

```
USER: You're messaging me too much

TEND: I can dial it back. Current settings:

      | Category        | Current      | Options                    |
      |----------------|--------------|----------------------------|
      | Weather alerts  | Immediate    | Immediate / Daily / Off    |
      | Task reminders  | Daily        | Daily / Weekly / Off       |
      | Health checks   | Every 7 days | 7 / 14 / 30 days / Off    |
      | Season tips     | As needed    | As needed / Monthly / Off  |

      What would you like to change?
```

The agent IS the settings UI. No separate settings screen.

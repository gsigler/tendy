# 17 — UX/UI Flows

[← Back to Plan Index](README.md)

---

## App Navigation Architecture

Single-screen chat-primary layout. No tab bar. The chat IS the app.

```
┌─────────────────────────────────────────────────────────────────────┐
│                     TOP-LEVEL NAVIGATION MAP                        │
│                                                                     │
│  ┌──────────┐    auth success    ┌──────────────────────────────┐  │
│  │  AUTH     │──────────────────>│  SESSION LIST                │  │
│  │  SCREEN   │                   │  (landing after login)       │  │
│  │          │                    │                              │  │
│  │ Login    │                    │  Tap session / "New Chat"    │  │
│  │ Register │                    │         │                    │  │
│  └──────────┘                    └─────────┼────────────────────┘  │
│                                            │                       │
│                                            v                       │
│                              ┌──────────────────────────────┐      │
│                              │  MAIN CHAT SCREEN            │      │
│                              │  (95% of time spent here)    │      │
│                              │                              │      │
│                              │  - All garden management     │      │
│                              │  - Rich inline elements      │      │
│                              │  - Quick-action buttons      │      │
│                              │  - Photo capture + send      │      │
│                              │  - Settings via conversation │      │
│                              └──────┬───────────┬───────────┘      │
│                                     │           │                  │
│                         header tap  │           │  bell icon tap   │
│                                     v           v                  │
│                      ┌──────────────┐  ┌─────────────────┐        │
│                      │ SESSION LIST │  │ NOTIFICATION    │        │
│                      │ (slide-over) │  │ INBOX           │        │
│                      │              │  │ (slide-over)    │        │
│                      │ Past chats   │  │ Unread alerts   │        │
│                      │ New session  │  │ Tap -> chat     │        │
│                      └──────────────┘  └─────────────────┘        │
│                                                                     │
│  PATTERN: Single-screen with slide-over drawers.                   │
│  No tab bar. No hamburger menu. The chat is home.                  │
└─────────────────────────────────────────────────────────────────────┘
```

### Navigation Transitions

```
Auth Screen ──[login/register]──> Session List
Session List ──[tap session]───> Chat (load history)
Session List ──[new chat]──────> Chat (fresh, auto-briefing)
Session List ──[first login]───> Chat (onboarding flow)
Chat ──[swipe right / menu]────> Session List (drawer)
Chat ──[bell icon]─────────────> Notification Inbox (drawer)
Chat ──[push notification]─────> Chat (scrolled to alert msg)
Notification Inbox ──[tap]─────> Chat (context loaded)
Any screen ──[token expired]───> Auth Screen
```

---

## Authentication Flow

```
┌────────────────────────────────────────────────────────────────────┐
│                        AUTH SCREEN                                  │
│                                                                    │
│                    ┌──────────────────────┐                        │
│                    │                      │                        │
│                    │      [Tend logo]     │                        │
│                    │                      │                        │
│                    │  Your AI garden      │                        │
│                    │  assistant           │                        │
│                    │                      │                        │
│                    ├──────────────────────┤                        │
│                    │                      │                        │
│                    │  Email               │                        │
│                    │  ┌────────────────┐  │                        │
│                    │  │                │  │                        │
│                    │  └────────────────┘  │                        │
│                    │                      │                        │
│                    │  Password            │                        │
│                    │  ┌────────────────┐  │                        │
│                    │  │                │  │                        │
│                    │  └────────────────┘  │                        │
│                    │                      │                        │
│                    │  [    Log In     ]   │                        │
│                    │                      │                        │
│                    │  Don't have an       │                        │
│                    │  account? Sign up    │                        │
│                    │                      │                        │
│                    └──────────────────────┘                        │
│                                                                    │
│  Existing user -> Session List                                     │
│  New user -> Chat (auto-starts onboarding)                         │
└────────────────────────────────────────────────────────────────────┘
```

---

## Main Chat Interface Layout

### Mobile (375pt — Primary)

```
┌─────────────────────────────────────────┐
│ HEADER BAR                          44pt│
├─────────────────────────────────────────┤
│ [=]  Greg's Garden          [2]  [...] │
│      Spring 2026 · 8b                   │
├─────────────────────────────────────────┤
│                                         │
│  CHAT MESSAGE AREA            scrollable│
│                                         │
│  ┌─ PROACTIVE (pinned if unread) ────┐  │
│  │ TEND NOTICED                      │  │
│  │ Frost advisory tonight...         │  │
│  │ [Mark Done] [Dismiss]             │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ┌─ AGENT MESSAGE ───────────────────┐  │
│  │ Good morning! Here's your update: │  │
│  │                                   │  │
│  │ ┌─ WEATHER CARD ──────────────┐   │  │
│  │ │ Today: 82F sunny            │   │  │
│  │ │ Thu 92 | Fri 95 | Sat 88   │   │  │
│  │ └────────────────────────────┘   │  │
│  │                                   │  │
│  │ ┌─ TASK LIST ─────────────────┐   │  │
│  │ │ !! Water tomatoes  [v] [x]  │   │  │
│  │ │ !  Check lettuce   [v] [x]  │   │  │
│  │ │    Sow green beans          │   │  │
│  │ └────────────────────────────┘   │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ┌─ USER MESSAGE ────────────────────┐  │
│  │                 just watered all  │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ┌─ AGENT MESSAGE ───────────────────┐  │
│  │ Got it — logged watering for      │  │
│  │ all 4 spaces.                     │  │
│  └───────────────────────────────────┘  │
│                                         │
├─────────────────────────────────────────┤
│ INPUT AREA                          56pt│
│ ┌───────────────────────────────────┐   │
│ │ [camera] Message Tend...      [>] │   │
│ └───────────────────────────────────┘   │
└─────────────────────────────────────────┘

KEY:
  [=]   Session list drawer toggle
  [2]   Notification badge (unread count)
  [...]  Overflow menu (garden switch, help)
  [v]   Complete task
  [x]   Skip task
  [>]   Send message
```

### Desktop (1280pt+)

```
┌──────────────────────────────────────────────────────────────────┐
│  Greg's Garden · Spring 2026 · Zone 8b              [2]   [..]  │
├───────────────┬──────────────────────────────────────────────────┤
│               │                                                  │
│  SESSION      │        CHAT AREA (max-width 720px, centered)     │
│  LIST         │                                                  │
│  (always      │   [T]                                            │
│   visible     │   ┌────────────────────────────────────────┐     │
│   sidebar,    │   │ Good morning! Here's your update:      │     │
│   260px)      │   │                                        │     │
│               │   │ [WEATHER CARD]                         │     │
│  ┌─────────┐  │   │ [TASK LIST]                            │     │
│  │Today    │  │   │                                        │     │
│  │ Morning │  │   │ Heads up about next week...            │     │
│  │ check-in│  │   └────────────────────────────────────────┘     │
│  └─────────┘  │                                                  │
│  ┌─────────┐  │                    ┌───────────────────────────┐  │
│  │Yesterday│  │                    │ just watered everything   │  │
│  │ Basil   │  │                    └───────────────────────────┘  │
│  │ health  │  │                                                  │
│  └─────────┘  │   [T]                                            │
│  ┌─────────┐  │   ┌────────────────────────────────────────┐     │
│  │Yesterday│  │   │ Got it — logged watering...            │     │
│  │ Fall    │  │   └────────────────────────────────────────┘     │
│  │ planning│  │                                                  │
│  └─────────┘  │   ┌────────────────────────────────────────┐     │
│               │   │ [cam]  Message Tend...            [>]  │     │
│  [+ New Chat] │   └────────────────────────────────────────┘     │
├───────────────┴──────────────────────────────────────────────────┤
│  260px sidebar     remaining width (centered chat)               │
└──────────────────────────────────────────────────────────────────┘
```

### Breakpoints

| Width | Layout | Session List | Rich Cards |
|-------|--------|-------------|------------|
| < 640px | Mobile | Slide-over drawer | Full-width, h-scroll if wide |
| 640-1024px | Tablet | Slide-over drawer | Centered, more room |
| > 1024px | Desktop | Persistent sidebar (260px) | Full width, no scroll needed |

---

## Message Type Catalog

### User Text Message

```
┌─────────────────────────────────────────┐
│                                         │
│              ┌────────────────────────┐  │
│              │ just watered the       │  │
│              │ tomatoes and peppers   │  │
│              └────────────────────────┘  │
│                            12:34 PM     │
│                                         │
│  Right-aligned, accent background,      │
│  rounded corners, dark text.            │
└─────────────────────────────────────────┘
```

### Agent Text Response

```
┌─────────────────────────────────────────┐
│                                         │
│  [T]                                    │
│  ┌────────────────────────────────────┐ │
│  │ Got it — logged watering for      │ │
│  │ tomatoes and peppers. Next check   │ │
│  │ in 2-3 days depending on temps.    │ │
│  │                                    │ │
│  │ While you were out there, did you  │ │
│  │ notice anything on the tomatoes?   │ │
│  └────────────────────────────────────┘ │
│  12:34 PM                               │
│                                         │
│  Left-aligned, neutral bg, Tend avatar. │
│  Markdown rendered (bold, lists, links).│
└─────────────────────────────────────────┘
```

### Agent Response with Task List Card

```
┌─────────────────────────────────────────┐
│  [T]                                    │
│  ┌────────────────────────────────────┐ │
│  │ Good morning! Here's your update:  │ │
│  │                                    │ │
│  │ ┌──────────────────────────────┐   │ │
│  │ │ TODAY'S TASKS                │   │ │
│  │ ├──────────────────────────────┤   │ │
│  │ │ !! Water tomatoes & peppers  │   │ │
│  │ │    Last: 2 days ago, 82F     │   │ │
│  │ │            [Done]  [Skip]    │   │ │
│  │ ├──────────────────────────────┤   │ │
│  │ │ !  Check lettuce             │   │ │
│  │ │    8 days since last obs.    │   │ │
│  │ │            [Done]  [Skip]    │   │ │
│  │ ├──────────────────────────────┤   │ │
│  │ │    Sow green beans           │   │ │
│  │ │    Soil temp 62F — ready     │   │ │
│  │ │            [Done]  [Snooze]  │   │ │
│  │ └──────────────────────────────┘   │ │
│  │                                    │ │
│  │ Temps climbing to 90F+ next week.  │ │
│  └────────────────────────────────────┘ │
│                                         │
│  INTERACTION: Tapping [Done] sends      │
│  CompleteTask. Card updates in-place:   │
│  strikethrough + checkmark. [Snooze]    │
│  shows picker: [1 day] [3 days] [1 wk] │
└─────────────────────────────────────────┘
```

### Agent Response with Garden Grid

```
┌─────────────────────────────────────────┐
│  [T]                                    │
│  ┌────────────────────────────────────┐ │
│  │ Here's your Sunny Bed:            │ │
│  │                                    │ │
│  │ ┌──────────────────────────────┐   │ │
│  │ │ SUNNY BED (4x8 ft)          │   │ │
│  │ │    1    2    3    4          │   │ │
│  │ │  ┌────┬────┬────┬────┐      │   │ │
│  │ │ A│ SG │ SG │ JP │ JP │      │   │ │
│  │ │  ├────┼────┼────┼────┤      │   │ │
│  │ │ B│ SG │ SG │ JP │ BA │      │   │ │
│  │ │  ├────┼────┼────┼────┤      │   │ │
│  │ │ C│    │    │ BA │ BA │      │   │ │
│  │ │  └────┴────┴────┴────┘      │   │ │
│  │ │                              │   │ │
│  │ │ SG Sun Gold   [producing]    │   │ │
│  │ │ JP Jalapeno   [producing]    │   │ │
│  │ │ BA Basil      [transplanted] │   │ │
│  │ └──────────────────────────────┘   │ │
│  │                                    │ │
│  │ 3 empty squares in row C.         │ │
│  └────────────────────────────────────┘ │
│                                         │
│  Cells color-coded by health.           │
│  Tapping a cell asks about that plant.  │
└─────────────────────────────────────────┘
```

### Agent Response with Schedule Timeline

```
┌─────────────────────────────────────────┐
│  [T]                                    │
│  ┌────────────────────────────────────┐ │
│  │ Here's your planting schedule:     │ │
│  │                                    │ │
│  │ ┌──────────────────────────────┐   │ │
│  │ │ SPRING 2026 SCHEDULE         │   │ │
│  │ │                              │   │ │
│  │ │ MAR           APR            │   │ │
│  │ │ 15  22  29  5   12  19      │   │ │
│  │ │ ├───┤                        │   │ │
│  │ │ Lettuce: sow now             │   │ │
│  │ │ ├───────┤                    │   │ │
│  │ │ Tomato: transplant window    │   │ │
│  │ │     ├───┤                    │   │ │
│  │ │     Green beans: sow late    │   │ │
│  │ │         March                │   │ │
│  │ │             ├───┤            │   │ │
│  │ │             Basil: transplant│   │ │
│  │ └──────────────────────────────┘   │ │
│  │                                    │ │
│  │ Tap any item for details.          │ │
│  └────────────────────────────────────┘ │
│                                         │
│  Horizontal scroll on mobile.           │
└─────────────────────────────────────────┘
```

### Agent Response with Weather Card

```
┌─────────────────────────────────────────┐
│  [T]                                    │
│  ┌────────────────────────────────────┐ │
│  │ ┌──────────────────────────────┐   │ │
│  │ │ TODAY    82F / 58F   Sunny   │   │ │
│  │ ├──────────────────────────────┤   │ │
│  │ │ Thu  92/71 Sun               │   │ │
│  │ │ Fri  95/73 Sun               │   │ │
│  │ │ Sat  88/68 Storms            │   │ │
│  │ │ Sun  85/65 Cloudy            │   │ │
│  │ ├──────────────────────────────┤   │ │
│  │ │ ALERT: 90F+ next week.      │   │ │
│  │ │ Watch for heat stress.       │   │ │
│  │ └──────────────────────────────┘   │ │
│  │                                    │ │
│  │ Your lettuce may struggle in that  │ │
│  │ heat. Want me to plan shade cloth? │ │
│  └────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### Photo Message (User Sends Photo)

```
┌─────────────────────────────────────────┐
│          ┌──────────────────────────┐   │
│          │ my basil looks weird     │   │
│          │                          │   │
│          │ ┌────────────────────┐   │   │
│          │ │                    │   │   │
│          │ │  [photo thumbnail] │   │   │
│          │ │    240 x 180       │   │   │
│          │ │                    │   │   │
│          │ └────────────────────┘   │   │
│          └──────────────────────────┘   │
│                             12:45 PM    │
│                                         │
│  Photo embedded in user bubble.         │
│  Tap photo for full-screen view.        │
│  Auto-uploads via POST /api/v1/photos.  │
└─────────────────────────────────────────┘
```

### Observation Result (Agent Analyzes Photo)

```
┌─────────────────────────────────────────┐
│  [T]                                    │
│  ┌────────────────────────────────────┐ │
│  │ I can see yellowing on the lower   │ │
│  │ leaves of your basil.              │ │
│  │                                    │ │
│  │ ┌──────────────────────────────┐   │ │
│  │ │ HEALTH OBSERVATION           │   │ │
│  │ ├──────────────────────────────┤   │ │
│  │ │ Plant:  Basil (Patio)       │   │ │
│  │ │ Health: Healthy -> Watch     │   │ │
│  │ │                              │   │ │
│  │ │ Possible causes:            │   │ │
│  │ │  1. Overwatering (likely)   │   │ │
│  │ │  2. Nutrient deficiency     │   │ │
│  │ │                              │   │ │
│  │ │ Action: Let soil dry out    │   │ │
│  │ │ between waterings.          │   │ │
│  │ └──────────────────────────────┘   │ │
│  │                                    │ │
│  │ Want a follow-up reminder?         │ │
│  │                                    │ │
│  │ [Yes, in 3 days] [No thanks]       │ │
│  └────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### Proactive Notification Message

```
┌─────────────────────────────────────────┐
│  [T]  TEND NOTICED                      │
│  ┌────────────────────────────────────┐ │
│  │ Frost advisory tonight — low of    │ │
│  │ 31F expected.                      │ │
│  │                                    │ │
│  │ ┌──────────────────────────────┐   │ │
│  │ │ AT RISK:                     │   │ │
│  │ │  Sun Gold (Sunny Bed) PROTECT│   │ │
│  │ │  Jalapeno (Sunny Bed) PROTECT│   │ │
│  │ │  Basil (Patio)       PROTECT│   │ │
│  │ │                              │   │ │
│  │ │ SAFE:                        │   │ │
│  │ │  Lettuce (Bed 2) frost-hardy │   │ │
│  │ └──────────────────────────────┘   │ │
│  │                                    │ │
│  │ I've added "Cover tender plants"   │ │
│  │ to your evening tasks.             │ │
│  │                                    │ │
│  │ [Mark Done] [Dismiss]              │ │
│  └────────────────────────────────────┘ │
│                                         │
│  Distinguished from regular messages:   │
│  - "TEND NOTICED" label above bubble    │
│  - Amber tinted background              │
│  - Always has action buttons            │
│  - Pinned to top when unread            │
└─────────────────────────────────────────┘
```

### Confirmation Dialog

```
┌─────────────────────────────────────────┐
│  [T]                                    │
│  ┌────────────────────────────────────┐ │
│  │ ┌──────────────────────────────┐   │ │
│  │ │ CONFIRM                      │   │ │
│  │ ├──────────────────────────────┤   │ │
│  │ │ Remove 'Lettuce mix' from   │   │ │
│  │ │ your garden?                 │   │ │
│  │ │                              │   │ │
│  │ │ This will delete:            │   │ │
│  │ │  - The planting record      │   │ │
│  │ │  - 6 events                 │   │ │
│  │ │  - 2 completed tasks        │   │ │
│  │ │                              │   │ │
│  │ │ [Yes, delete]  [Mark as     │   │ │
│  │ │   (red)        finished]    │   │ │
│  │ └──────────────────────────────┘   │ │
│  └────────────────────────────────────┘ │
│                                         │
│  Destructive option in red.             │
│  Safe alternative always offered.       │
│  Card collapses to result after tap.    │
└─────────────────────────────────────────┘
```

### Quick-Action Chips

```
┌─────────────────────────────────────────┐
│  [T]                                    │
│  ┌────────────────────────────────────┐ │
│  │ Should I add all of these to your  │ │
│  │ garden?                            │ │
│  └────────────────────────────────────┘ │
│                                         │
│  ┌──────────────────┐ ┌──────────────┐  │
│  │ Yes, add them all│ │ Let me pick  │  │
│  └──────────────────┘ └──────────────┘  │
│  ┌──────────────────┐                   │
│  │ Show plan first  │                   │
│  └──────────────────┘                   │
│                                         │
│  Chip buttons below the message.        │
│  Tapping sends chip text as user msg.   │
│  Chips disappear after any selection.   │
└─────────────────────────────────────────┘
```

### Progress/Loading Indicator

```
┌─────────────────────────────────────────┐
│  [T]                                    │
│  ┌────────────────────────────────────┐ │
│  │ Checking your garden...     [done] │ │
│  │ Looking up the weather...   [done] │ │
│  │ Planning your week...       [. . ] │ │
│  └────────────────────────────────────┘ │
│                                         │
│  Each tool call = one line.             │
│  Friendly labels, not tool names:       │
│    ListPlantings -> "Checking garden"   │
│    GetForecast   -> "Looking up weather"│
│    GetWeekPlan   -> "Planning your week"│
│    CreatePlanting-> "Adding to garden"  │
│                                         │
│  Transitions smoothly into text as      │
│  tokens stream in. Lines fade out.      │
│                                         │
│  If >10s total:                         │
│  ┌────────────────────────────────────┐ │
│  │ Still working...      [Cancel]     │ │
│  └────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### Error State

```
┌─────────────────────────────────────────┐
│  [T]                                    │
│  ┌────────────────────────────────────┐ │
│  │ The planting "tomato" wasn't found.│ │
│  │                                    │ │
│  │ Here's what you have:              │ │
│  │  - Sun Gold tomato (Sunny Bed)    │ │
│  │  - Cherokee Purple (Bed 2)        │ │
│  │  - Roma tomato (Bed 3)            │ │
│  │                                    │ │
│  │ Which one did you mean?            │ │
│  └────────────────────────────────────┘ │
│                                         │
│  No scary error UI. Agent explains      │
│  plainly and offers next step.          │
└─────────────────────────────────────────┘
```

---

## Key User Flows

### Flow A: New User Signup -> Onboarding -> First Garden

```
┌─────────┐     ┌─────────┐     ┌──────────────────────────────────┐
│  AUTH    │     │ (skip   │     │  CHAT: "Getting Started"         │
│  SCREEN  │────>│ session │────>│                                  │
│  Register│     │  list)  │     │  1. Agent greeting               │
└─────────┘     └─────────┘     │     "Hey! I'm Tend..."           │
                                 │                                  │
                                 │  2. Ask location                 │
                                 │     User: "Austin, TX"           │
                                 │     Agent: zone 8b, frost dates  │
                                 │                                  │
                                 │  3. Ask about spaces             │
                                 │     User: "3 raised beds, 4x8"  │
                                 │     Agent: [GARDEN SUMMARY CARD] │
                                 │                                  │
                                 │  4. Ask what to grow             │
                                 │     User: "tomatoes, peppers..." │
                                 │     Agent: [SCHEDULE CARD]       │
                                 │                                  │
                                 │  5. Confirm plan                 │
                                 │     [Yes, create plan] chip      │
                                 │     Agent creates all data       │
                                 │                                  │
                                 │  6. Next morning                 │
                                 │     First morning briefing       │
                                 └──────────────────────────────────┘

TIME: 3-5 minutes, ~8-12 message turns.
CREATES: Garden, Season, 3-4 Spaces, 5-8 Plantings, initial Tasks.
```

### Flow B: Daily Check-In

```
┌──────────────┐     ┌──────────────────────────────────────────┐
│ Push notif:  │     │ CHAT SCREEN                              │
│ "Morning     │────>│                                          │
│ garden       │     │ [PROACTIVE pinned top]                   │
│ update"      │     │   Morning briefing with:                 │
│              │     │   [WEATHER CARD]                         │
│     OR       │     │   [TASK LIST with quick-actions]         │
│              │     │                                          │
│ User opens   │────>│ User taps [Done] on "Water tomatoes"     │
│ app          │     │   -> Card updates: strikethrough + check │
│              │     │   -> Agent: "Logged. How do they look?"  │
└──────────────┘     │                                          │
                      │ User: "looking great, lots of flowers"   │
                      │   -> Agent: "Logged observation. Expect  │
                      │      first fruit in ~2 weeks."           │
                      └──────────────────────────────────────────┘

TOTAL TIME: ~2 minutes for a full daily check-in.
```

### Flow C: Photo Health Check

```
┌────────────┐    ┌────────────────────────────────────────────┐
│ Tap camera │    │ CHAT SCREEN                                │
│ icon in    │───>│                                            │
│ input bar  │    │ [USER: "my basil looks weird" + photo]     │
└────────────┘    │                                            │
                   │ [LOADING: "Uploading..." -> "Analyzing..."]│
                   │                                            │
                   │ [AGENT: text + HEALTH OBSERVATION CARD]    │
                   │   Plant: Basil (Patio)                     │
                   │   Health: Healthy -> Watch                 │
                   │   Cause: Likely overwatering               │
                   │   Action: Let soil dry out                 │
                   │                                            │
                   │ [Yes, remind me in 3 days] [No thanks]     │
                   └────────────────────────────────────────────┘

BACKEND: POST /photos triggers Observation Agent (~3-5s).
Result written to photos.observation_json + health updated.
```

### Flow D: Planning Session

```
┌────────────────────────────────────────────────────────────────┐
│ USER: "I want to plan my fall garden"                          │
│                                                                │
│ [LOADING: checking garden... frost dates... schedule...]       │
│                                                                │
│ AGENT: Crop suggestions organized by start date                │
│   "What sounds interesting?"                                   │
│                                                                │
│ USER: "Definitely kale and lettuce. And Brussels sprouts."     │
│                                                                │
│ AGENT: Details + [SCHEDULE TIMELINE CARD]                      │
│   "Want me to create these and set up the schedule?"           │
│   [Yes, create the plan] [Let me think about it]               │
│                                                                │
│ User taps [Yes, create the plan]                               │
│                                                                │
│ [LOADING: adding... scheduling... generating tasks...]         │
│                                                                │
│ AGENT: "Done! 3 plantings with tasks. First action:            │
│ start Brussels sprout seeds by Thursday. I'll remind you."     │
└────────────────────────────────────────────────────────────────┘
```

### Flow E: Proactive Frost Alert

```
┌──────────────┐
│ PUSH NOTIF   │
│ "Frost alert │
│  tonight —   │
│  cover your  │──> Opens chat, scrolled to:
│  plants"     │
└──────────────┘
    │
    v
┌────────────────────────────────────────────────────────────────┐
│ [TEND NOTICED — amber bg, pinned]                              │
│   Frost advisory tonight — 31F                                 │
│   [FROST ALERT CARD: at-risk + safe plants]                    │
│   "Added 'Cover tender plants' to tonight's tasks."            │
│   [Mark Done] [Dismiss]                                        │
│                                                                │
│ User taps [Mark Done]                                          │
│                                                                │
│ AGENT: "Logged cover-up. I'll check forecast tomorrow.         │
│ If temps stay above 40F after sunrise, uncover around 9 AM."   │
│                                                                │
│ --- NEXT MORNING ---                                           │
│                                                                │
│ [TEND NOTICED]                                                 │
│   "Low hit 33F. Plants should be fine. 45F now — safe          │
│    to uncover."                                                │
│   [Uncover done] [Leave covered]                               │
└────────────────────────────────────────────────────────────────┘
```

---

## Session Management

```
┌─────────────────────────────────────────┐
│ SESSION LIST (slide-over drawer)        │
├─────────────────────────────────────────┤
│                                         │
│  [+  New Conversation               ]   │
│                                         │
├─────────────────────────────────────────┤
│  TODAY                                  │
│  ┌───────────────────────────────────┐  │
│  │ Morning check-in            7:15a│  │
│  │ Watering, task updates           │  │
│  │ 12 messages                      │  │
│  └───────────────────────────────────┘  │
│                                         │
│  YESTERDAY                              │
│  ┌───────────────────────────────────┐  │
│  │ Basil health check          3:22p│  │
│  │ Photo analysis, overwatering     │  │
│  │ 8 messages                       │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │ Fall garden planning        9:45a│  │
│  │ Brussels sprouts, kale schedule  │  │
│  │ 16 messages                      │  │
│  └───────────────────────────────────┘  │
│                                         │
│  LAST WEEK                              │
│  ┌───────────────────────────────────┐  │
│  │ Getting Started            Mar 12│  │
│  │ Onboarding, garden setup         │  │
│  │ 24 messages                      │  │
│  └───────────────────────────────────┘  │
│                                         │
└─────────────────────────────────────────┘

SESSION RULES:
- Each session tied to a season_id
- Title auto-generated from first user message
- Summary compressed when >30 messages (sliding window)
- Sessions grouped by date, never deleted
- If last session >6 hours old, new one auto-created
- Morning briefings start a fresh daily session
- Tapping a session loads history into chat
```

---

## Notification Inbox

```
┌─────────────────────────────────────────┐
│ NOTIFICATIONS (slide-over drawer)       │
├─────────────────────────────────────────┤
│                                         │
│  UNREAD                                 │
│  ┌───────────────────────────────────┐  │
│  │  [!] Frost advisory tonight 5:30p│  │
│  │      Cover tender plants          │  │
│  │      [View in chat]               │  │
│  ├───────────────────────────────────┤  │
│  │  [!] Lettuce may bolt      7:15a │  │
│  │      90F+ next week               │  │
│  │      [View in chat]               │  │
│  └───────────────────────────────────┘  │
│                                         │
│  EARLIER                                │
│  ┌───────────────────────────────────┐  │
│  │  [v] Basil follow-up      Mar 17 │  │
│  │  [v] Weekly summary       Mar 16 │  │
│  │  [v] Green beans ready    Mar 14 │  │
│  └───────────────────────────────────┘  │
│                                         │
│  Mark all as read                       │
└─────────────────────────────────────────┘

PRIORITY -> DELIVERY:
  urgent  -> push notification + in-app
  high    -> in-app, top of morning briefing
  normal  -> in morning briefing batch
  low     -> in weekly summary only
```

---

## Fallback State (LLM Down)

```
┌─────────────────────────────────────────┐
│ [=] Greg's Garden            [2] [...] │
├─────────────────────────────────────────┤
│                                         │
│  (previous chat messages still visible) │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │                                   │  │
│  │  Tend is having trouble thinking  │  │
│  │  right now. Here's what I can     │  │
│  │  still show you:                  │  │
│  │                                   │  │
│  │  ┌─────────────┐ ┌────────────┐  │  │
│  │  │ Your Week   │ │ Your       │  │  │
│  │  │ Plan        │ │ Plantings  │  │  │
│  │  └─────────────┘ └────────────┘  │  │
│  │  ┌─────────────┐ ┌────────────┐  │  │
│  │  │ Open Tasks  │ │ Recent     │  │  │
│  │  │             │ │ Events     │  │  │
│  │  └─────────────┘ └────────────┘  │  │
│  │                                   │  │
│  │  Trying again in 30 seconds...    │  │
│  │                                   │  │
│  └───────────────────────────────────┘  │
│                                         │
├─────────────────────────────────────────┤
│ (input disabled, grayed out)            │
└─────────────────────────────────────────┘

DEGRADATION LADDER:
  1. LLM slow (>5s)     -> loading indicator, streaming works
  2. LLM timeout (>15s) -> "Try again?" + fallback buttons
  3. LLM error (500)    -> fallback buttons, auto-retry 30s
  4. LLM down (>5 min)  -> fallback is primary UI
  5. API down           -> "No connection" banner

Fallback buttons call REST directly:
  GET /api/v1/seasons/{id}/weekplan
  GET /api/v1/seasons/{id}/plantings
  GET /api/v1/seasons/{id}/tasks
  POST /api/v1/tasks/{id}/complete  (quick-actions still work)

When LLM recovers: "I'm back! Looks like you completed
2 tasks while I was away — nice work."
```

---

## Rich Element Encoding

Rich elements are embedded in the AG-UI SSE stream as structured JSON within `TEXT_MESSAGE_CONTENT` events. The client detects JSON blocks with a `type` discriminator and renders the appropriate component.

```
SSE event: TEXT_MESSAGE_CONTENT
data: {"type": "text", "content": "Here's your Sunny Bed:"}

SSE event: TEXT_MESSAGE_CONTENT
data: {"type": "garden_grid", "space": {"name": "Sunny Bed", ...}, "cells": [...]}

SSE event: TEXT_MESSAGE_CONTENT
data: {"type": "text", "content": "3 empty squares. Want me to suggest something?"}
```

The client renders text as markdown and structured elements as React components, interleaved in order received.

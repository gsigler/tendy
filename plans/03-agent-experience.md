# 03 — The Agent Experience

[← Back to Plan Index](README.md)

---

## First-Time User Experience

The onboarding is a conversation, not a form. Example flow:

```
TEND: Hey! I'm Tend, your garden management assistant. I help you plan,
      track, and manage your garden through conversation — no forms or
      data entry needed. Let's get you set up. What's your name?

USER: Greg

TEND: Nice to meet you, Greg! Let's start with the basics.
      Where's your garden? A city/state or zip code works.

USER: Austin, TX

TEND: Austin — zone 8b, nice long growing season! Your typical last spring
      frost is around Feb 15, and first fall frost around Nov 28.
      Does that match your experience, or does your spot run warmer/cooler?

USER: Sounds about right. Maybe a little warmer, we're in south Austin

TEND: Got it — I'll note your microclimate tends warm. That can mean earlier
      transplant dates for you.

      Now tell me about your garden space. What are you working with?
      (Raised beds, in-ground rows, containers, all of the above?)

USER: I have 3 raised beds, each 4x8 feet, and some containers on the patio

TEND: Great setup! I've created your garden with:
      ┌──────────────────────────────────────┐
      │ Greg's Garden — Austin, TX (8b)      │
      │                                       │
      │ Bed 1 — Raised Bed, 4x8 ft           │
      │ Bed 2 — Raised Bed, 4x8 ft           │
      │ Bed 3 — Raised Bed, 4x8 ft           │
      │ Patio Containers — Containers         │
      │                                       │
      │ Season: Spring 2026 (Active)          │
      │ Last frost: ~Feb 15 | First frost: ~Nov 28│
      └──────────────────────────────────────┘

      Want to name the beds differently? And what are you hoping to grow?

USER: Bed 1 is the "sunny bed" - full sun. Beds 2 and 3 get partial shade
      after 2pm. I want to grow tomatoes, peppers, herbs, and maybe some
      lettuce and green beans

TEND: Perfect — I've renamed Bed 1 to "Sunny Bed" (full sun) and noted the
      afternoon shade on Beds 2 and 3.

      Based on your Austin climate and it being mid-March:
      * Tomatoes & peppers — start transplants NOW or buy starts. Last frost
        was ~Feb 15, so you're in the window
      * Lettuce — direct sow immediately, it'll bolt once summer heat hits
      * Green beans — wait until soil is 60F+, usually late March in Austin
      * Herbs — basil after last frost (you're clear), cilantro now before heat

      Want me to build out a full planting plan with specific varieties
      and a schedule? I can suggest varieties that do well in Austin heat.

USER: Yes! I love Sun Gold cherry tomatoes and jalapenos specifically

TEND: Great taste — Sun Golds are prolific in Texas heat.

      Here's your initial plan:
      ┌─────────────────────────────────────────────────────────┐
      │ PLANTING SCHEDULE — Spring 2026                         │
      │                                                         │
      │ NOW (March):                                            │
      │   Sun Gold tomato — transplant to Sunny Bed             │
      │   Jalapeno — transplant to Sunny Bed                    │
      │   Lettuce mix — direct sow in Bed 2 (shade helps)      │
      │   Cilantro — direct sow in Bed 3                        │
      │   Basil — transplant to Sunny Bed or Patio              │
      │                                                         │
      │ Late March:                                             │
      │   Green beans — direct sow in Bed 3                     │
      │                                                         │
      │ SUGGESTED ADDITIONS:                                    │
      │   Bell pepper — pairs with jalapeno, loves Austin       │
      │   Celebrity tomato — reliable producer, disease resistant│
      └─────────────────────────────────────────────────────────┘

      Should I add all of these to your garden? And do you have seeds/starts
      already, or do you need to buy?
```

---

## Daily Interaction Patterns

### Morning Check-In (Proactive)

```
TEND: Good morning, Greg! Here's your Wednesday garden update:

      Today: 82F, sunny — great growing weather

      TODAY'S TASKS:
      ┌─────────────────────────────────────────────┐
      │ !! Water tomatoes & peppers (last: 2 days   │
      │    ago, high of 82F today)      [Done] [Skip]│
      │                                               │
      │ !  Check lettuce — it's been 8 days since     │
      │    your last observation         [Done] [Skip]│
      │                                               │
      │    Green beans: ready to direct sow this      │
      │    weekend (soil temp is 62F)                  │
      └─────────────────────────────────────────────┘

      HEADS UP: Temperatures climbing to 90F+ next week.
      Your lettuce may start bolting. Consider shade cloth
      or plan a succession sow of heat-tolerant varieties.
```

### Quick Action Logging

```
USER: just watered everything

TEND: Got it — logged watering for all 4 spaces. Next watering check
      in 2-3 days depending on temps.

      While you were out there, did you notice anything on the
      tomatoes? They're at day 14 since transplant — should be
      establishing nicely.
```

### Photo Interaction

```
USER: my basil looks weird [photo attached]

TEND: I can see some yellowing on the lower leaves of your basil.
      This looks like it could be:

      1. **Overwatering** (most likely) — the soil looks quite damp
         and lower leaf yellowing is classic
      2. **Nutrient deficiency** — less likely this early

      I've logged this as a health observation.

      Recommendation: Let the soil dry out between waterings.
      Basil prefers to be slightly dry rather than constantly moist.
      Check again in 3-4 days.

      Want me to set a follow-up reminder?
```

### Harvest Tracking

```
USER: picked about 2 cups of cherry tomatoes and a handful of jalapenos

TEND: Nice harvest! Logged:
      * Sun Gold tomato — ~2 cups (~0.6 lbs)
      * Jalapeno — handful (~4 oz)

      Season totals: 3.2 lbs tomatoes | 1.1 lbs peppers

      Your Sun Golds are averaging 0.4 lbs/day now — peak production!
```

### Planning Session (Multi-Turn)

```
USER: I want to plan my fall garden

TEND: Great timing — mid-summer is when you should start thinking fall.
      Your first frost is October 20, which gives us about 13 weeks.

      For your zone 6b, here are fall crops that do well:

      Start now (July):
      - Broccoli, Brussels sprouts, cauliflower (start indoors, transplant Aug)
      - Fall beans (direct sow)

      Start August:
      - Lettuce, spinach, kale (direct sow — perfect for shady bed)
      - Beets, carrots, radishes
      - Cilantro, dill

      Start September:
      - Garlic (plant cloves for spring harvest)
      - Cover crops for empty beds

      What sounds interesting?

USER: Definitely want kale and lettuce in the shady bed. And I'd love
      to try Brussels sprouts but I've never grown them.

TEND: Brussels sprouts are fun but they're a long game — about 100 days
      to harvest, so you'd need to start seeds indoors now and transplant
      in August. They're heavy feeders and take up 4 square feet per plant.

      Here's a timeline:

      FALL PLANTING TIMELINE
      ═══════════════════════
      July 15    Start Brussels sprouts indoors (seed)
         |
      Aug 1      Direct sow kale + lettuce in Shady Bed
         |
      Aug 20     Transplant Brussels sprouts to Sunny Bed
         |
      Sep 15     Succession sow lettuce (second round)
         |
      Oct 1-20   Cover tender crops if frost threatens
         |
      Nov-Dec    Harvest Brussels sprouts (sweeter after frost!)

      Want me to create these plantings and set up the schedule?

      [Yes, create the plan] [Let me think about it]
```

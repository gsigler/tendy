# 08 — Rich Chat UI Elements

[← Back to Plan Index](README.md)

---

Modern chat is not just text. The agent returns structured content that the client renders as rich elements.

## Garden Grid Visualization

```json
{
  "type": "garden_grid",
  "space": { "name": "Sunny Bed", "width": 4, "length": 8 },
  "cells": [
    { "row": 0, "col": 0, "crop": "Sun Gold", "stage": "producing", "health": "healthy" },
    { "row": 0, "col": 1, "crop": "Sun Gold", "stage": "producing", "health": "healthy" }
  ],
  "legend": [
    { "label": "SG", "crop": "Sun Gold", "stage": "Producing", "health": "Healthy" }
  ]
}
```

Rendered as an interactive grid. Cells are tappable — tapping one sends "Tell me about the Early Girl in A1" to the agent.

---

## Task Cards with Quick Actions

```json
{
  "type": "task_list",
  "tasks": [
    {
      "id": "...",
      "title": "Water tomatoes & peppers",
      "priority": "high",
      "due": "today",
      "actions": ["complete", "skip", "snooze"]
    }
  ]
}
```

Tapping "Done" sends `CompleteTask` and the card updates in-place (strikethrough, green check). Tapping "Snooze" shows a dropdown: 1 day, 3 days, 1 week. Tapping "Skip" sends `SkipTask` and grays out the card.

---

## Planting Schedule Timeline

```json
{
  "type": "schedule_timeline",
  "items": [
    { "crop": "Lettuce", "action": "Direct sow", "date": "2026-03-20", "status": "upcoming" },
    { "crop": "Green beans", "action": "Direct sow", "date": "2026-03-28", "status": "upcoming" }
  ]
}
```

Rendered as a horizontal timeline with color-coded bars per stage. Tapping a bar opens that planting's detail.

---

## Weather Inline

```json
{
  "type": "weather_card",
  "today": { "high": 82, "low": 58, "condition": "sunny" },
  "alerts": [{ "type": "heat", "message": "90F+ expected next week" }],
  "forecast": [
    { "day": "Thu", "high": 92, "low": 71, "condition": "sunny" },
    { "day": "Fri", "high": 95, "low": 73, "condition": "sunny" },
    { "day": "Sat", "high": 88, "low": 68, "condition": "storms" }
  ]
}
```

---

## Confirmation Cards

```json
{
  "type": "confirmation",
  "message": "Delete 'Sun Gold tomato' from your garden? This removes all events and tasks for this planting.",
  "actions": [
    { "label": "Delete", "action": "confirm", "style": "danger" },
    { "label": "Cancel", "action": "cancel" }
  ]
}
```

---

## Progress Indicators (during tool calls)

The AG-UI protocol streams `TOOL_CALL_START` events. The client renders contextual status:

| Tool Call | User Sees |
|-----------|-----------|
| `ListPlantings` | "Checking your garden..." |
| `GetWeekPlan` | "Planning your week..." |
| `GetForecast` | "Checking the weather..." |
| `CreatePlanting` | "Adding to your garden..." |
| `AdvanceStage` | "Updating your planting..." |
| `GenerateAutoTasks` | "Setting up your schedule..." |

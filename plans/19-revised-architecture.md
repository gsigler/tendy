# 19 — Revised Technical Architecture

[← Back to Plan Index](README.md)

---

## Why the Pivot

The original architecture (C# / .NET 8 / Semantic Kernel) was chosen for the agent framework. Without it, .NET has the weakest AI/agent ecosystem of the major platforms. The core product — an LLM tool-calling loop with streaming — is exactly what the Vercel AI SDK was built for.

Going all-TypeScript means one language across backend, mobile app, and shared types. React Native (Expo) gives us iOS-first with Android for free later.

| Before | After | Why |
|--------|-------|-----|
| C# / .NET 8 | TypeScript / Node.js | AI SDK ecosystem, simpler tool-calling loop |
| Semantic Kernel `[KernelFunction]` | AI SDK `tool()` with Zod schemas | Built-in loop, validation, provider switching |
| ASP.NET Core | Hono (lightweight, fast, edge-ready) | No SSR needed; pure API server |
| EF Core + Npgsql | Drizzle ORM + postgres.js | Type-safe, lightweight, great migrations |
| Hangfire | BullMQ (Redis-backed) | Mature job queue for Node.js |
| Web frontend (unspecified) | React Native (Expo), iOS-first | One language everywhere; Android later for free |
| OpenAI-only | Multi-provider via AI SDK | Swap `openai('gpt-4o')` ↔ `anthropic('claude-sonnet-4-6')` in one line |

---

## Backend Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Runtime | Node.js 22 LTS | AI SDK native platform |
| Framework | Hono | Lightweight, typed, SSE support built-in, no Next.js overhead |
| AI/Agent | Vercel AI SDK (`ai` package) | Tool-calling loop, streaming, multi-provider, token tracking |
| Database | PostgreSQL 16 + Drizzle ORM | Type-safe schema, jsonb, text[], LISTEN/NOTIFY |
| Background Jobs | BullMQ + Redis | Reliable scheduling, retries, concurrency control |
| Push Notifications | Expo Notifications (wraps APNs + FCM) | Cross-platform push with one API |
| Auth | JWT (jose library) | Stateless, mobile-friendly |
| Image Storage | S3-compatible (R2 / MinIO / S3) | Presigned upload URLs from app |
| Weather | Open-Meteo (free, no key) | Cached 2x/day per location |
| Validation | Zod | Shared between API input validation and AI tool schemas |

---

## Project Structure

```
tend-api/
├── src/
│   ├── index.ts                    # Hono app entry point
│   ├── db/
│   │   ├── schema.ts               # Drizzle schema (all tables)
│   │   ├── migrations/             # Drizzle Kit migrations
│   │   └── seed.ts                 # Dev seed data
│   │
│   ├── services/                   # Business logic (shared by API + agent tools)
│   │   ├── garden.service.ts
│   │   ├── planting.service.ts
│   │   ├── space.service.ts
│   │   ├── task.service.ts
│   │   ├── event.service.ts
│   │   ├── catalog.service.ts
│   │   ├── planning.service.ts     # WeekPlan, schedule engine, auto-tasks
│   │   ├── weather.service.ts
│   │   ├── notification.service.ts
│   │   ├── photo.service.ts
│   │   └── memory.service.ts       # Agent memory (learned facts)
│   │
│   ├── agent/
│   │   ├── tools/                  # Tool definitions (Zod schema + execute fn)
│   │   │   ├── garden.tools.ts
│   │   │   ├── planting.tools.ts
│   │   │   ├── space.tools.ts
│   │   │   ├── task.tools.ts
│   │   │   ├── planning.tools.ts
│   │   │   ├── event.tools.ts
│   │   │   ├── memory.tools.ts
│   │   │   ├── weather.tools.ts
│   │   │   └── photo.tools.ts
│   │   ├── prompts/                # Versioned system prompts
│   │   │   ├── chat.v1.md
│   │   │   ├── planning.v1.md
│   │   │   ├── observation.v1.md
│   │   │   └── notification.v1.md
│   │   ├── chat-agent.ts           # User-facing chat (streamText)
│   │   ├── planning-agent.ts       # Background: schedule + recommendations
│   │   ├── observation-agent.ts    # Photo analysis (generateText with image)
│   │   └── notification-agent.ts   # Alert decisioning
│   │
│   ├── routes/                     # Hono route handlers
│   │   ├── auth.routes.ts
│   │   ├── chat.routes.ts          # SSE streaming endpoint
│   │   ├── photo.routes.ts
│   │   └── notification.routes.ts
│   │
│   ├── jobs/                       # BullMQ job definitions
│   │   ├── planning.job.ts         # Every 6 hours
│   │   ├── notification.job.ts     # Hourly during active hours
│   │   ├── weather.job.ts          # 2x/day per user location
│   │   └── worker.ts               # BullMQ worker entry point
│   │
│   ├── middleware/
│   │   ├── auth.ts                 # JWT verification
│   │   └── rate-limit.ts
│   │
│   └── lib/
│       ├── push.ts                 # Expo Push Notification Service client
│       ├── storage.ts              # S3 presigned URL generation
│       └── config.ts               # Environment config with Zod validation
│
├── drizzle.config.ts
├── package.json
├── tsconfig.json
└── tests/
    ├── services/                   # Unit tests for business logic
    ├── agent/                      # Tool execution tests
    └── integration/                # Full request/response tests
```

---

## How the Agent Works (Concrete)

### Chat Agent — The Core Loop

```typescript
// chat-agent.ts
import { streamText, tool } from 'ai';
import { openai } from '@ai-sdk/openai';

export async function handleChat(
  messages: CoreMessage[],
  context: UserContext,
) {
  const result = streamText({
    model: openai('gpt-4o'),   // or anthropic('claude-sonnet-4-6')
    system: buildSystemPrompt(context),
    messages,
    tools: {
      listPlantings: tool({
        description: 'List all plantings in the active season',
        parameters: z.object({
          seasonId: z.string().uuid(),
          stage: z.enum([...plantingStages]).optional(),
        }),
        execute: async ({ seasonId, stage }) => {
          return plantingService.list(context.userId, seasonId, { stage });
        },
      }),

      advanceStage: tool({
        description: 'Advance a planting to its next growth stage',
        parameters: z.object({
          plantingId: z.string().uuid(),
          newStage: z.enum([...plantingStages]),
        }),
        execute: async ({ plantingId, newStage }) => {
          return plantingService.advanceStage(context.userId, plantingId, newStage);
        },
      }),

      getWeekPlan: tool({
        description: 'Get prioritized tasks, upcoming work, and suggestions for this week',
        parameters: z.object({ seasonId: z.string().uuid() }),
        execute: async ({ seasonId }) => {
          return planningService.getWeekPlan(context.userId, seasonId);
        },
      }),

      // ... all other tools
    },
    maxSteps: 5,  // Max tool-calling iterations before forcing a response
    onStepFinish: async ({ usage, toolCalls }) => {
      // Track token usage per user per agent type
      await tokenService.record(context.userId, 'chat', usage);
      // Log tool calls for observability
      if (toolCalls) {
        await agentRunService.logToolCalls(context.userId, 'chat', toolCalls);
      }
    },
  });

  return result;
}
```

### Background Planning Agent

```typescript
// planning-agent.ts
import { generateText, tool } from 'ai';
import { openai } from '@ai-sdk/openai';

export async function runPlanningAgent(userId: string, seasonId: string) {
  const context = await buildPlanningContext(userId, seasonId);

  const result = await generateText({
    model: openai('gpt-4o-mini'),
    system: planningPrompt,
    messages: [{
      role: 'user',
      content: `Review the current garden state and generate recommendations.
        Weather: ${JSON.stringify(context.weather)}
        Overdue tasks: ${context.overdueTasks.length}
        Plantings needing attention: ${JSON.stringify(context.attentionPlantings)}
        Days since last check: ${context.daysSinceLastCheck}`,
    }],
    tools: {
      createRecommendation: tool({
        description: 'Create a recommendation for the user',
        parameters: z.object({
          category: z.enum(['frost_warning', 'schedule_adjustment', 'health_alert', 'season_tip']),
          title: z.string(),
          description: z.string(),
          confidence: z.number().min(0).max(1),
          suggestedAction: z.object({
            type: z.string(),
            params: z.record(z.unknown()),
          }).optional(),
        }),
        execute: async (rec) => {
          return recommendationService.create(userId, seasonId, rec);
        },
      }),
      createTask: tool({
        description: 'Create a task for the user (high-confidence actions only)',
        parameters: z.object({
          title: z.string(),
          type: z.enum([...taskTypes]),
          priority: z.enum(['low', 'medium', 'high']),
          dueAt: z.string().datetime(),
          plantingId: z.string().uuid().optional(),
        }),
        execute: async (task) => {
          return taskService.create(userId, seasonId, task);
        },
      }),
    },
    maxSteps: 3,
  });
}
```

### Streaming SSE Endpoint

```typescript
// chat.routes.ts
import { Hono } from 'hono';
import { stream } from 'hono/streaming';

const chat = new Hono();

chat.post('/api/v1/chat', authMiddleware, async (c) => {
  const { sessionId, messages } = await c.req.json();
  const userId = c.get('userId');

  // Load conversation history
  const history = await conversationService.getMessages(userId, sessionId);

  // Build context
  const context = await buildUserContext(userId, sessionId);

  // Stream the response
  const result = await handleChat([...history, ...messages], context);

  // Return as SSE stream
  return stream(c, async (stream) => {
    for await (const chunk of result.textStream) {
      await stream.write(`data: ${JSON.stringify({
        type: 'text_delta',
        content: chunk,
      })}\n\n`);
    }

    // Persist assistant response
    const finalResult = await result;
    await conversationService.saveMessage(userId, sessionId, {
      role: 'assistant',
      content: finalResult.text,
    });
  });
});
```

---

## Mobile Client (React Native / Expo)

### Why React Native + Expo

- **All TypeScript** — one language across backend, mobile, and shared type definitions
- **iOS-first, Android free** — ship iOS first, flip a switch for Android when ready
- **Expo manages the hard stuff** — push notifications, OTA updates, app store builds, camera
- **Shared types** — Zod schemas on the backend can generate TypeScript types the app imports directly via a shared package or codegen

### Technology Choices

| Component | Technology |
|-----------|-----------|
| Framework | Expo SDK 52+ (managed workflow) |
| UI | React Native + Expo Router (file-based routing) |
| Styling | NativeWind (Tailwind for RN) or Tamagui |
| State | Zustand (lightweight, no boilerplate) |
| Networking | fetch + custom SSE parser (lightweight) |
| Local Storage | expo-sqlite + Drizzle ORM (same Drizzle as backend!) |
| Push Notifications | expo-notifications (wraps APNs + FCM) |
| Camera/Photos | expo-image-picker |
| Auth | expo-secure-store (Keychain on iOS, Keystore on Android) |
| OTA Updates | EAS Update (skip App Store for non-native changes) |

### Monorepo Structure

```
tend/
├── packages/
│   └── shared/                     # Shared TypeScript types + Zod schemas
│       ├── src/
│       │   ├── types.ts            # PlantingDto, TaskDto, WeekPlan, etc.
│       │   ├── enums.ts            # PlantingStage, HealthStatus, etc.
│       │   └── schemas.ts          # Zod schemas (reused for API validation + app types)
│       └── package.json
│
├── apps/
│   ├── api/                        # Hono backend (see Backend Stack above)
│   │   └── ...
│   │
│   └── mobile/                     # Expo React Native app
│       ├── app/                    # Expo Router file-based routes
│       │   ├── (tabs)/
│       │   │   ├── chat.tsx        # Primary chat screen
│       │   │   ├── garden.tsx      # Garden overview
│       │   │   ├── tasks.tsx       # Task list
│       │   │   └── settings.tsx    # Settings
│       │   ├── chat/
│       │   │   └── [sessionId].tsx # Chat session detail
│       │   └── _layout.tsx         # Tab bar layout
│       ├── components/
│       │   ├── chat/
│       │   │   ├── MessageBubble.tsx
│       │   │   ├── GardenGrid.tsx      # Rich card: tappable grid
│       │   │   ├── TaskCard.tsx         # Rich card: swipe to complete
│       │   │   ├── ScheduleTimeline.tsx # Rich card: horizontal scroll
│       │   │   ├── WeatherCard.tsx      # Rich card: forecast
│       │   │   ├── ConfirmationCard.tsx # Rich card: destructive action confirm
│       │   │   └── ToolCallIndicator.tsx # "Checking your garden..."
│       │   └── garden/
│       │       ├── SpaceGrid.tsx
│       │       └── PlantingRow.tsx
│       ├── lib/
│       │   ├── api.ts              # API client (typed with shared schemas)
│       │   ├── sse.ts              # SSE stream parser for chat
│       │   ├── auth.ts             # JWT management with SecureStore
│       │   ├── sync.ts             # Offline queue + sync logic
│       │   └── notifications.ts    # Expo push notification setup
│       ├── stores/
│       │   ├── chat.store.ts       # Zustand: messages, streaming state
│       │   ├── garden.store.ts     # Zustand: cached garden data
│       │   └── auth.store.ts       # Zustand: auth state
│       ├── app.json                # Expo config
│       └── package.json
│
├── package.json                    # Workspace root (pnpm/turborepo)
└── turbo.json                      # Turborepo config (build, dev, typecheck)
```

### Key Screens

```
Tab Bar
├── Chat (primary)
│   ├── Message list with rich cards
│   │   ├── Text messages (markdown rendered via react-native-markdown-display)
│   │   ├── Garden grid (tappable Pressable grid)
│   │   ├── Task cards (Swipeable via react-native-gesture-handler)
│   │   ├── Schedule timeline (horizontal FlatList)
│   │   ├── Weather card
│   │   └── Confirmation cards (inline, not native alerts)
│   ├── Text input + photo button + suggested prompts
│   └── Session history (drawer or swipe from left)
│
├── Garden (quick reference)
│   ├── Season overview
│   ├── Space list → grid view
│   └── Planting list → detail
│
├── Tasks (standalone view)
│   ├── Today / This Week / Overdue (SectionList)
│   └── Swipe to complete/skip
│
└── Settings
    ├── Garden setup
    ├── Notification preferences
    └── Account / subscription
```

### Offline Strategy

Expo-sqlite + Drizzle ORM gives us a local database that mirrors key server tables:

| Data | Offline Behavior |
|------|-----------------|
| Plantings | Cached in local SQLite, read-only offline |
| Tasks | Cached, completions queued and synced when online |
| Chat history | Cached locally, new messages queued |
| Photos | Stored locally, uploaded when online |
| Notifications | Cached, read status synced |
| Agent chat | Requires connectivity (shows "You're offline" with cached garden view) |

```typescript
// lib/sync.ts — offline action queue
import * as SQLite from 'expo-sqlite';

interface PendingAction {
  id: string;
  endpoint: string;
  method: 'POST' | 'PUT' | 'DELETE';
  body: unknown;
  createdAt: number;
}

export class SyncQueue {
  private db: SQLite.SQLiteDatabase;

  async enqueue(action: Omit<PendingAction, 'id' | 'createdAt'>) {
    await this.db.runAsync(
      'INSERT INTO pending_actions (id, endpoint, method, body, created_at) VALUES (?, ?, ?, ?, ?)',
      [crypto.randomUUID(), action.endpoint, action.method, JSON.stringify(action.body), Date.now()]
    );
  }

  async processWhenOnline(api: ApiClient) {
    const pending = await this.db.getAllAsync<PendingAction>('SELECT * FROM pending_actions ORDER BY created_at');
    for (const action of pending) {
      await api.fetch(action.endpoint, { method: action.method, body: action.body });
      await this.db.runAsync('DELETE FROM pending_actions WHERE id = ?', [action.id]);
    }
  }
}
```

### Push Notifications

Expo Notifications abstracts APNs (iOS) and FCM (Android) behind one API:

```
Notification Agent → writes to notifications table
                   → sends via Expo Push API (or direct APNs/FCM)
                   → Phone shows notification
                   → User taps → Expo Router deep links to chat session
```

```typescript
// Backend: sending a push notification
import { Expo } from 'expo-server-sdk';

const expo = new Expo();

await expo.sendPushNotificationsAsync([{
  to: user.expoPushToken,
  title: 'Frost Warning Tonight',
  body: 'Low of 31°F expected. Your tomatoes and peppers need protection.',
  data: {
    type: 'frost_warning',
    sessionId: '...',
    recommendationId: '...',
  },
  categoryId: 'FROST_ALERT',  // For notification actions
}]);
```

```typescript
// Mobile: handling notification tap → deep link
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';

Notifications.addNotificationResponseReceivedListener((response) => {
  const { type, sessionId } = response.notification.request.content.data;
  router.push(`/chat/${sessionId}`);
});

// Notification action categories (respond without opening app)
Notifications.setNotificationCategoryAsync('FROST_ALERT', [
  { identifier: 'MARK_PROTECTED', buttonTitle: 'Done', options: { isDestructive: false } },
  { identifier: 'VIEW_DETAILS', buttonTitle: 'View Details', options: { opensAppToForeground: true } },
]);
```

### SSE Streaming in React Native

```typescript
// lib/sse.ts — lightweight SSE parser for chat streaming
export async function* streamChat(
  sessionId: string,
  messages: ChatMessage[],
  token: string,
): AsyncGenerator<ChatEvent> {
  const response = await fetch(`${API_URL}/api/v1/chat`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sessionId, messages }),
  });

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n\n');
    buffer = lines.pop()!; // Keep incomplete chunk

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        yield JSON.parse(line.slice(6)) as ChatEvent;
      }
    }
  }
}
```

### Rich Chat UI Components

The structured JSON from doc 08 maps to React Native components:

```tsx
// components/chat/GardenGrid.tsx
function GardenGrid({ grid }: { grid: GardenGridData }) {
  const { sendMessage } = useChatStore();

  return (
    <View style={styles.grid}>
      {Array.from({ length: grid.length }, (_, row) => (
        <View key={row} style={styles.gridRow}>
          {Array.from({ length: grid.width }, (_, col) => {
            const cell = grid.cellAt(row, col);
            return (
              <Pressable
                key={col}
                style={[styles.cell, healthColor(cell?.health)]}
                onPress={() => sendMessage(`Tell me about the ${cell?.crop} in row ${row}, col ${col}`)}
              >
                <Text style={styles.cellLabel}>{cell?.cropAbbrev ?? ''}</Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// components/chat/TaskCard.tsx
function TaskCard({ task }: { task: TaskData }) {
  return (
    <Swipeable
      renderRightActions={() => (
        <>
          <SwipeAction label="Done" color="green" onPress={() => completeTask(task.id)} />
          <SwipeAction label="Skip" color="gray" onPress={() => skipTask(task.id)} />
        </>
      )}
    >
      <View style={styles.taskCard}>
        <PriorityBadge priority={task.priority} />
        <View>
          <Text style={styles.taskTitle}>{task.title}</Text>
          <Text style={styles.taskDue}>{task.dueLabel}</Text>
        </View>
      </View>
    </Swipeable>
  );
}
```

### Shared Types — The All-TypeScript Advantage

The killer benefit of all-TypeScript: **one source of truth for types across backend and mobile.**

```typescript
// packages/shared/src/types.ts
// Imported by BOTH the API server and the mobile app

export interface PlantingDto {
  id: string;
  crop: string;
  variety: string | null;
  stage: PlantingStage;
  health: HealthStatus;
  spaceName: string | null;
  startedAt: string | null;
  daysInStage: number;
}

export interface WeekPlanDto {
  overdueTasks: TaskDto[];
  upcomingTasks: TaskDto[];
  suggestions: string[];
  weather: WeatherSummary | null;
}

// Zod schemas used for API validation AND type inference
export const createPlantingSchema = z.object({
  crop: z.string().min(1),
  variety: z.string().optional(),
  sourceType: z.enum(['seed', 'start']),
  seasonId: z.string().uuid(),
  spaceId: z.string().uuid().optional(),
});

export type CreatePlantingInput = z.infer<typeof createPlantingSchema>;
```

---

## Data Architecture Changes

The schema stays the same (19 tables from doc 06), just expressed in Drizzle instead of EF Core:

```typescript
// db/schema.ts (excerpt)
import { pgTable, uuid, text, timestamp, integer, real, jsonb, uniqueIndex } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const gardens = pgTable('gardens', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  name: text('name').notNull(),
  location: text('location'),
  hardinessZone: text('hardiness_zone'),
  latitude: real('latitude'),
  longitude: real('longitude'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const plantings = pgTable('plantings', {
  id: uuid('id').defaultRandom().primaryKey(),
  seasonId: uuid('season_id').notNull().references(() => seasons.id),
  catalogId: uuid('catalog_id').references(() => catalogEntries.id),
  spaceId: uuid('space_id').references(() => spaces.id),
  crop: text('crop').notNull(),
  variety: text('variety'),
  sourceType: text('source_type').notNull().default('seed'),
  stage: text('stage').notNull().default('planned'),
  health: text('health').notNull().default('healthy'),
  quantity: integer('quantity'),
  quantityUnit: text('quantity_unit'),
  gridSquares: integer('grid_squares'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  hardenedAt: timestamp('hardened_at', { withTimezone: true }),
  transplantedAt: timestamp('transplanted_at', { withTimezone: true }),
  targetStartDate: timestamp('target_start_date', { withTimezone: true }),
  targetHardenDate: timestamp('target_harden_date', { withTimezone: true }),
  targetTransplantDate: timestamp('target_transplant_date', { withTimezone: true }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ... remaining tables follow same pattern
```

---

## Background Jobs

BullMQ replaces Hangfire. Redis is the only new infrastructure dependency.

```typescript
// jobs/planning.job.ts
import { Queue, Worker } from 'bullmq';

export const planningQueue = new Queue('planning', { connection: redis });

// Schedule: every 6 hours
await planningQueue.upsertJobScheduler('planning-sweep', {
  pattern: '0 */6 * * *',
}, {
  name: 'sweep',
});

// Worker
new Worker('planning', async (job) => {
  const users = await getActiveUsers();
  for (const user of users) {
    const season = await getActiveSeason(user.id);
    if (season) {
      await runPlanningAgent(user.id, season.id);
    }
  }
}, { connection: redis, concurrency: 5 });
```

```typescript
// jobs/notification.job.ts
// Runs hourly during user's active hours (9am-9pm local)
new Worker('notifications', async (job) => {
  const users = await getUsersInActiveHours();
  for (const user of users) {
    await runNotificationAgent(user.id);
  }
}, { connection: redis, concurrency: 10 });
```

---

## Provider Switching

The single biggest win of the AI SDK — testing multiple providers is trivial:

```typescript
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';

// Agent model configuration — change in one place
const models = {
  chat: openai('gpt-4o'),                    // or anthropic('claude-sonnet-4-6')
  planning: openai('gpt-4o-mini'),            // or anthropic('claude-haiku-4-5-20251001')
  observation: openai('gpt-4o'),              // needs vision
  notification: openai('gpt-4o-mini'),        // cheapest possible
} as const;

// Spike 1: test tool-calling reliability across providers
// Just swap the model and re-run the same 50-query test suite
```

---

## Deployment

No web frontend = no Vercel needed. The backend is a standard Node.js server.

| Component | Where | Cost |
|-----------|-------|------|
| API Server | Railway / Fly.io / any VPS | ~$5-10/mo |
| PostgreSQL | Railway / Supabase / Neon | ~$0-10/mo |
| Redis | Railway / Upstash | ~$0-5/mo |
| Image Storage | Cloudflare R2 | ~$0 (free tier generous) |
| Push Notifications | Expo Push Service (free) | $0 |
| App Builds | EAS Build (free tier: 30 builds/mo) | $0 |
| OTA Updates | EAS Update (free tier: 1k users) | $0 |
| App Store | Apple Developer Account | $99/year |

Total infrastructure: **~$15-25/month** at launch (before LLM costs).

EAS (Expo Application Services) handles the iOS/Android build pipeline — no Mac needed for CI/CD builds.

---

## Updated Implementation Phases

The phases from doc 13 stay the same, just with different tech:

### Phase 0: Foundation (Week 1-2)
- Hono app with JWT auth
- Drizzle schema + migrations + PostgreSQL in Docker
- GardenService, PlantingService with DTOs
- Chat agent with 5 tools (ListPlantings, GetPlanting, CreatePlanting, AdvanceStage, GetWeekPlan)
- SSE streaming endpoint
- Seed data
- **Mobile:** Expo app scaffold, auth flow, barebones chat screen connecting to SSE endpoint

### Phase 1: Core Agent (Week 3-6)
- All tools wired up
- Conversation persistence (sliding window)
- Confirmation flow, disambiguation, error handling
- Full system prompt
- **Mobile:** Rich chat cards (task cards, grids), session history, Garden tab

### Phase 2: Intelligence (Week 7-10)
- Schedule engine, WeekPlan, auto-tasks
- Agent memory
- **Mobile:** Tasks tab, schedule timeline, garden grid visualization, offline cache

### Phase 3: Autonomy (Week 11-16)
- Weather integration
- Background agents (Planning, Observation, Notification)
- Photo upload + vision analysis
- Push notifications via Expo Push
- Token budget enforcement
- **Mobile:** Push notification handling, photo capture, notification preferences
- **Launch:** First TestFlight build, EAS Build pipeline

---

## What This Architecture Solves from Doc 18 Feedback

| Gap (from doc 18) | How This Addresses It |
|---|---|
| No frontend decision | React Native (Expo), iOS-first — resolved |
| No offline story | expo-sqlite + sync queue — resolved |
| No push notification detail | Expo Push with notification actions — resolved |
| No accessibility plan | React Native accessibility props (accessibilityLabel, etc.) + platform-native VoiceOver/TalkBack |
| Outdoor use / bright sunlight | Native app handles brightness/contrast better than web |
| "Dirty hands" voice input | Platform dictation works in any TextInput — free, no code needed |
| Multi-device sync | Server-first architecture, notifications clear via API — straightforward |
| Two languages problem | All TypeScript — eliminated |

---

## Risks Specific to This Architecture

| Risk | Mitigation |
|------|-----------|
| App Store review delays | Submit early and often; keep first submission minimal. EAS Build automates the pipeline |
| React Native SSE streaming | `fetch` + `ReadableStream` works in RN's Hermes engine; tested in Expo SDK 50+ |
| Expo managed workflow limitations | Escape hatch: `expo prebuild` for native modules if needed. Camera, notifications, SQLite all supported in managed |
| Redis adds infrastructure | Upstash serverless Redis is near-zero cost at low scale |
| Shared package versioning | Turborepo handles builds; shared package is internal, not published |
| Android quality if iOS-first | Expo handles most platform differences; test on Android before enabling Play Store build |

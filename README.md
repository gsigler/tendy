# Tendy

AI-powered gardening assistant. Monorepo with a Hono API backend, Vercel AI SDK for OpenAI, PostgreSQL with Drizzle ORM, and JWT auth.

## Structure

```
tendy/
├── apps/api/          # Hono + Node.js API server
│   ├── src/db/        # Drizzle schema + migrations runner
│   ├── src/middleware/ # JWT auth middleware
│   ├── src/routes/    # API route handlers
│   └── drizzle/       # SQL migration files
├── packages/shared/   # Shared types & Zod schemas
├── plans/             # Architecture docs
└── docker-compose.yml # API + PostgreSQL
```

## Prerequisites

- **Node.js 22+**
- **pnpm 9+** — enable via `corepack enable && corepack prepare pnpm@9.15.4 --activate`
- **Docker** — for PostgreSQL (and optional containerized API)
- **OpenAI API key** — get one at https://platform.openai.com/api-keys

## Quick Start (Local)

```bash
# Install dependencies
pnpm install

# Set up environment
cp .env.example .env
# Edit .env — add your OPENAI_API_KEY and set a JWT_SECRET

# Start PostgreSQL
docker compose up -d db

# Run database migrations
pnpm --filter @tendy/api db:migrate

# Run in development (hot reload, auto-loads .env)
pnpm dev
```

The API starts on **http://localhost:3000**.

## Quick Start (Docker)

Runs both the API and PostgreSQL. Migrations run automatically on startup.

```bash
cp .env.example .env
# Edit .env — add your OPENAI_API_KEY and set a JWT_SECRET

docker compose up --build
```

## API Endpoints

### `GET /health`

Health check. No auth required.

```bash
curl http://localhost:3000/health
# {"status":"ok","service":"tendy-api"}
```

### `POST /api/auth/register`

Create a new account. Returns a JWT token.

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"your-password","name":"Your Name"}'
```

### `POST /api/auth/login`

Authenticate and get a JWT token.

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"your-password"}'
```

### `POST /api/chat` (authenticated)

Send a message to the gardening AI. Requires `Authorization: Bearer <token>`. Returns a streaming response (Vercel AI SDK data stream format).

```bash
TOKEN="your-jwt-token"
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"message": "When should I plant tomatoes in zone 7?"}'
```

## Development

```bash
# Typecheck all packages
pnpm typecheck

# Lint all packages
pnpm lint

# Run only the API in dev mode
pnpm --filter @tendy/api dev

# Generate a new migration after schema changes
pnpm --filter @tendy/api db:generate

# Run migrations
pnpm --filter @tendy/api db:migrate

# Open Drizzle Studio (database browser)
pnpm --filter @tendy/api db:studio
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 22 |
| Framework | Hono |
| AI | Vercel AI SDK + OpenAI |
| Database | PostgreSQL 16 + Drizzle ORM |
| Auth | JWT (jose) + bcrypt |
| Validation | Zod (shared schemas) |
| Monorepo | pnpm workspaces + Turborepo |
| Deploy | Docker |

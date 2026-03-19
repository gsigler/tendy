# Tendy

AI-powered gardening assistant. Monorepo with a Hono API backend and Vercel AI SDK for OpenAI integration.

## Structure

```
tendy/
├── apps/api/          # Hono + Node.js API server
├── packages/shared/   # Shared types & Zod schemas
├── plans/             # Architecture docs
└── docker-compose.yml
```

## Prerequisites

- **Node.js 22+**
- **pnpm 9+** — enable via `corepack enable && corepack prepare pnpm@9.15.4 --activate`
- **OpenAI API key** — get one at https://platform.openai.com/api-keys

## Quick Start (Local)

```bash
# Install dependencies
pnpm install

# Set up environment
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY

# Run in development (hot reload)
pnpm dev

# Or build and run production
pnpm build
pnpm --filter @tendy/api start
```

The API starts on **http://localhost:3000**.

## Quick Start (Docker)

```bash
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY

docker compose up --build
```

## API Endpoints

### `GET /health`

Health check.

```bash
curl http://localhost:3000/health
# {"status":"ok","service":"tendy-api"}
```

### `POST /api/chat`

Send a message to the gardening AI. Returns a streaming response (Vercel AI SDK data stream format).

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "When should I plant tomatoes in zone 7?"}'
```

## Development

```bash
# Typecheck all packages
pnpm typecheck

# Run only the API in dev mode
pnpm --filter @tendy/api dev
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 22 |
| Framework | Hono |
| AI | Vercel AI SDK + OpenAI |
| Validation | Zod (shared schemas) |
| Monorepo | pnpm workspaces + Turborepo |
| Deploy | Docker |

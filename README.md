# Tendy

Garden management API with an MCP (Model Context Protocol) server interface. Built with Hono, PostgreSQL, Drizzle ORM, and JWT auth.

## Structure

```
tendy/
├── apps/api/            # Hono + Node.js API server
│   ├── src/services/    # Business logic (shared by REST + MCP)
│   ├── src/routes/v1/   # REST API route handlers
│   ├── src/mcp/         # MCP server + tool definitions
│   ├── src/db/          # Drizzle schema + migrations
│   └── src/middleware/  # JWT/API key auth
├── packages/shared/     # Shared types & Zod schemas
└── docker-compose.yml   # API + PostgreSQL
```

## Prerequisites

- **Node.js 22+**
- **pnpm 9+** — enable via `corepack enable && corepack prepare pnpm@9.15.4 --activate`
- **Docker** — for PostgreSQL

## Quick Start

```bash
pnpm install
cp .env.example .env
# Edit .env — set a JWT_SECRET

docker compose up -d db
pnpm --filter @tendy/api db:migrate
pnpm dev
```

The API starts on **http://localhost:3000**.

## Authentication

Two auth methods, both via `Authorization: Bearer <token>`:

1. **JWT** — short-lived (7 days), obtained via login
2. **API key** — long-lived, created via REST, ideal for MCP clients

```bash
# Register
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"your-password","name":"Your Name"}'

# Create an API key (use the JWT from register/login)
curl -X POST http://localhost:3000/api/v1/api-keys \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"my-mcp-client"}'
# Returns: { "key": "tndy_...", ... } — save this, it's shown once
```

## REST API

All `/api/v1/*` routes require auth (except `/api/v1/auth/*`).

| Resource | Endpoints |
|----------|-----------|
| Gardens | `GET/POST /gardens`, `GET/PATCH/DELETE /gardens/:id` |
| Seasons | `GET/POST /gardens/:id/seasons`, `GET/PATCH/DELETE /seasons/:id`, `GET /seasons/:id/summary` |
| Spaces | `GET/POST /seasons/:id/spaces`, `GET/PATCH/DELETE /spaces/:id`, grid operations |
| Plantings | `GET/POST /seasons/:id/plantings`, `GET/PATCH/DELETE /plantings/:id`, advance-stage, health, move |
| Tasks | `GET/POST /seasons/:id/tasks`, `GET/PATCH/DELETE /tasks/:id`, complete, skip |
| Events | `GET/POST /seasons/:id/events`, `DELETE /events/:id` |
| Harvests | `GET/POST /seasons/:id/harvests`, `GET/PATCH/DELETE /harvests/:id`, `GET /seasons/:id/harvest-summary` |
| Photos | `GET/POST /seasons/:id/photos`, `GET/PATCH/DELETE /photos/:id` |
| Catalog | `GET/POST /catalog`, `GET/PATCH/DELETE /catalog/:id`, reviews |
| Planning | `GET /seasons/:id/week-plan`, `GET /seasons/:id/planting-schedule`, `POST /seasons/:id/generate-tasks` |
| API Keys | `GET/POST /api-keys`, `DELETE /api-keys/:id` |

## Photos

Photos can be attached to seasons, plantings, harvests, spaces, or catalog entries. Storage uses Railway Buckets (S3-compatible). The upload flow uses presigned URLs:

1. `POST /api/v1/photos/upload-url` — generates a presigned PUT URL and creates the photo record
2. Client PUTs the file directly to the returned URL
3. `GET /api/v1/photos/:id` — generates a fresh presigned GET URL for viewing

If Railway Buckets aren't configured, photos can store an external URL directly instead.

## MCP Server

59 tools exposed via SSE transport.

- **Establish session:** `GET /mcp` — opens the SSE stream, returns a `sessionId`
- **Send messages:** `POST /mcp/message?sessionId=<id>`
- **Auth:** `Authorization: Bearer <token>` (JWT or API key)

```json
{
  "mcpServers": {
    "tendy": {
      "url": "https://your-tendy-url.com/mcp",
      "headers": {
        "Authorization": "Bearer tndy_your_api_key_here"
      }
    }
  }
}
```

## Development

```bash
pnpm typecheck                          # Typecheck all packages
pnpm --filter @tendy/api test          # Run tests (~150 tests)
pnpm --filter @tendy/api db:generate   # Generate a new migration
pnpm --filter @tendy/api db:migrate    # Run pending migrations
pnpm --filter @tendy/api db:studio     # Drizzle Studio
```

> **Note:** Always use `db:generate` to create migrations — never edit `drizzle/meta/_journal.json` by hand. A wrong `when` timestamp causes Drizzle to silently skip the migration on deploy.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 22 |
| Framework | Hono |
| MCP | @modelcontextprotocol/sdk (SSE transport) |
| Database | PostgreSQL 16 + Drizzle ORM |
| Auth | JWT (jose) + API keys + bcryptjs |
| Storage | Railway Buckets (S3-compatible, presigned URLs) |
| Validation | Zod |
| Monorepo | pnpm workspaces + Turborepo |
| Deploy | Railway |

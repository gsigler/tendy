# Tendy

Garden management CRUD API with MCP (Model Context Protocol) server interface. Built with Hono, PostgreSQL, Drizzle ORM, and JWT auth.

## Structure

```
tendy/
├── apps/api/            # Hono + Node.js API server
│   ├── src/services/    # Business logic (shared by REST + MCP)
│   ├── src/routes/v1/   # REST API route handlers
│   ├── src/mcp/         # MCP server + tool definitions
│   ├── src/db/          # Drizzle schema + migrations
│   └── src/middleware/   # JWT/API key auth
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
| Catalog | `GET/POST /catalog`, `GET/PATCH/DELETE /catalog/:id`, reviews |
| Planning | `GET /seasons/:id/week-plan`, `GET /seasons/:id/planting-schedule`, `POST /seasons/:id/generate-tasks` |
| API Keys | `GET/POST /api-keys`, `DELETE /api-keys/:id` |

## MCP Server

54 tools exposed via Streamable HTTP transport at `POST /mcp`.

MCP clients authenticate with a Bearer token (JWT or API key) and manage sessions via the `mcp-session-id` header.

## Development

```bash
pnpm typecheck        # Typecheck all packages
pnpm --filter @tendy/api test   # Run tests (118 tests)
pnpm --filter @tendy/api db:generate  # Generate migration
pnpm --filter @tendy/api db:migrate   # Run migrations
pnpm --filter @tendy/api db:studio    # Drizzle Studio
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 22 |
| Framework | Hono |
| MCP | @modelcontextprotocol/sdk |
| Database | PostgreSQL 16 + Drizzle ORM |
| Auth | JWT (jose) + API keys + bcryptjs |
| Validation | Zod |
| Monorepo | pnpm workspaces + Turborepo |
| Deploy | Docker |

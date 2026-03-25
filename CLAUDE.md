# Tendy — Agent Instructions

## Database Migrations

**Always use `pnpm db:generate` to create migrations. Never write or edit `_journal.json` by hand.**

```bash
cd apps/api
pnpm db:generate
```

This ensures the `when` timestamp in `drizzle/meta/_journal.json` is set correctly. Drizzle uses this timestamp to determine migration order — a stale or hand-written timestamp will cause the migration to be silently skipped on deploy.

After generating, commit both the `.sql` file and the updated `_journal.json`.

## Running Migrations Locally

```bash
pnpm --filter @tendy/api db:migrate
```

## Deployment

Migrations run automatically on deploy via `preDeployCommand` in `railway.toml`, and again at app startup in `src/index.ts`.

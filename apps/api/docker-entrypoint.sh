#!/bin/sh
set -e

echo "Running database migrations..."
node apps/api/dist/db/migrate.js

echo "Starting API server..."
exec "$@"

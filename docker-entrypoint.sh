#!/bin/sh
set -e

# Trim whitespace so "RUN_MIGRATIONS_ON_START= true" is still treated as "true"
RUN_MIGRATIONS="$(echo "${RUN_MIGRATIONS_ON_START}" | tr -d '[:space:]')"

if [ "$RUN_MIGRATIONS" = "true" ]; then
  echo "[entrypoint] Running database migrations..."
  npx sequelize-cli db:migrate
  echo "[entrypoint] Migrations complete."
else
  echo "[entrypoint] Skipping migrations (RUN_MIGRATIONS_ON_START != true)."
fi

echo "[entrypoint] Starting server..."
exec node dist/server.js

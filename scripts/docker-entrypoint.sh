#!/bin/sh
set -e

if [ "${RUN_MIGRATIONS_ON_START:-true}" != "false" ]; then
  echo "[entrypoint] Bootstrapping database schema if empty..."
  node scripts/bootstrap-schema.js

  echo "[entrypoint] Running database migrations (NODE_ENV=${NODE_ENV:-production})..."
  npx sequelize-cli db:migrate --env "${NODE_ENV:-production}"
  echo "[entrypoint] Migrations complete."
else
  echo "[entrypoint] Skipping migrations (RUN_MIGRATIONS_ON_START=false)."
fi

exec node dist/server.js

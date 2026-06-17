#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

require('dotenv/config');
require('../dist/config/associations');
const sequelize = require('../dist/config/database').default;

async function needsBootstrap() {
  const [rows] = await sequelize.query(`
    SELECT
      EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'user_users'
      ) AS has_user_users,
      EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'orders'
      ) AS has_orders
  `);
  const row = rows[0];
  return !row.has_user_users && !row.has_orders;
}

async function seedMigrationHistory() {
  const migrationsDir = path.join(__dirname, '../migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.js') && !file.startsWith('_'))
    .sort();

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "SequelizeMeta" (
      name VARCHAR(255) NOT NULL PRIMARY KEY
    );
  `);

  for (const file of files) {
    await sequelize.query(
      'INSERT INTO "SequelizeMeta" (name) VALUES (:name) ON CONFLICT (name) DO NOTHING',
      { replacements: { name: file } },
    );
  }

  console.log(`[bootstrap] Marked ${files.length} migrations as applied`);
}

async function main() {
  await sequelize.authenticate();

  if (!(await needsBootstrap())) {
    console.log('[bootstrap] Core tables already present — skipping schema sync');
    return;
  }

  console.log('[bootstrap] Empty database detected — creating tables from models...');
  await sequelize.sync();
  console.log('[bootstrap] Schema sync complete');

  // Models already match the latest schema; legacy migrations are for upgrades only.
  await seedMigrationHistory();
}

main()
  .then(async () => {
    await sequelize.close();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('[bootstrap] Failed:', err);
    try {
      await sequelize.close();
    } catch {
      // ignore
    }
    process.exit(1);
  });

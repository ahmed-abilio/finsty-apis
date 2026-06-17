#!/usr/bin/env node
'use strict';

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

async function main() {
  await sequelize.authenticate();

  if (!(await needsBootstrap())) {
    console.log('[bootstrap] Core tables already present — skipping schema sync');
    return;
  }

  console.log('[bootstrap] Empty database detected — creating tables from models...');
  await sequelize.sync();
  console.log('[bootstrap] Schema sync complete');
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

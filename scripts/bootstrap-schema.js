#!/usr/bin/env node
'use strict';

require('dotenv/config');
require('../dist/config/associations');
const sequelize = require('../dist/config/database').default;

async function hasStoresTable() {
  const [rows] = await sequelize.query(`
    SELECT 1 AS found
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'stores'
    LIMIT 1
  `);
  return rows.length > 0;
}

async function main() {
  await sequelize.authenticate();

  if (await hasStoresTable()) {
    console.log('[bootstrap] Database already has tables — skipping schema sync');
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

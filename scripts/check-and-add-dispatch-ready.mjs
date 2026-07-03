/**
 * Stop API + any stuck `npm run migrate` before running:
 *   node scripts/check-and-add-dispatch-ready.mjs
 */
import 'dotenv/config';
import pg from 'pg';

const {
  DB_HOST = 'localhost',
  DB_PORT = '5432',
  DB_NAME = 'finsty_db',
  DB_USER = 'finsty_user',
  DB_PASSWORD = '',
  DB_SSL,
  NODE_ENV,
} = process.env;

const useDbSsl = DB_SSL === 'true' || (NODE_ENV === 'production' && DB_SSL !== 'false');

const client = new pg.Client({
  host: DB_HOST,
  port: parseInt(DB_PORT, 10),
  database: DB_NAME,
  user: DB_USER,
  password: DB_PASSWORD,
  ssl: useDbSsl ? { rejectUnauthorized: false } : undefined,
  connectionTimeoutMillis: 15000,
  statement_timeout: 60000,
});

try {
  await client.connect();
  console.log('Connected.');

  const col = await client.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'is_dispatch_ready';
  `);

  if (col.rows.length > 0) {
    console.log('Column is_dispatch_ready already exists.');
  } else {
    console.log('Adding is_dispatch_ready column...');
    await client.query(`
      ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS is_dispatch_ready BOOLEAN NOT NULL DEFAULT false;
    `);
    console.log('Column added.');
  }

  const meta = await client.query(`
    SELECT name FROM "SequelizeMeta"
    WHERE name = '20260703120000-add-is-dispatch-ready-to-orders.js';
  `);

  if (meta.rows.length === 0) {
    await client.query(`
      INSERT INTO "SequelizeMeta" (name)
      VALUES ('20260703120000-add-is-dispatch-ready-to-orders.js');
    `);
    console.log('Recorded migration in SequelizeMeta.');
  } else {
    console.log('Migration already recorded in SequelizeMeta.');
  }
} catch (err) {
  console.error('Failed:', err.message);
  console.error(
    '\nIf this timed out, a stuck migration is still locking `orders`.\n' +
      '1. End the stuck `npm run migrate` process (Task Manager)\n' +
      '2. Stop `npm run dev`\n' +
      '3. Run this script again\n',
  );
  process.exit(1);
} finally {
  await client.end().catch(() => undefined);
}

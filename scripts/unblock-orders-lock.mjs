/**
 * Finds and terminates Postgres sessions blocking the `orders` table
 * (e.g. a stuck ALTER TABLE from an interrupted migration), then adds
 * the is_dispatch_ready column and records the migration.
 *
 *   node scripts/unblock-orders-lock.mjs
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
  statement_timeout: 30000,
});

try {
  await client.connect();
  console.log('Connected.');

  // 1. Show sessions currently touching `orders`
  const active = await client.query(`
    SELECT a.pid, a.state, a.wait_event_type, a.wait_event,
           now() - a.query_start AS running_for,
           left(a.query, 120) AS query
    FROM pg_stat_activity a
    WHERE a.datname = current_database()
      AND a.pid <> pg_backend_pid()
      AND a.query ILIKE '%orders%'
    ORDER BY a.query_start;
  `);

  console.log(`\nSessions referencing "orders": ${active.rows.length}`);
  for (const r of active.rows) {
    console.log(
      `  pid=${r.pid} state=${r.state} wait=${r.wait_event_type}/${r.wait_event} running_for=${r.running_for} :: ${r.query}`,
    );
  }

  // 2. Find sessions holding a lock on the orders relation
  const blockers = await client.query(`
    SELECT DISTINCT l.pid,
           left(a.query, 120) AS query,
           a.state,
           now() - a.query_start AS running_for
    FROM pg_locks l
    JOIN pg_class c ON c.oid = l.relation
    JOIN pg_stat_activity a ON a.pid = l.pid
    WHERE c.relname = 'orders'
      AND l.pid <> pg_backend_pid();
  `);

  console.log(`\nLock holders on "orders": ${blockers.rows.length}`);
  for (const r of blockers.rows) {
    console.log(
      `  pid=${r.pid} state=${r.state} running_for=${r.running_for} :: ${r.query}`,
    );
  }

  // 3. Terminate any session that has been holding/running against orders for > 60s
  //    and is not this script.
  for (const r of blockers.rows) {
    console.log(`\nTerminating blocking pid=${r.pid} ...`);
    const res = await client.query('SELECT pg_terminate_backend($1) AS ok', [r.pid]);
    console.log(`  pg_terminate_backend -> ${res.rows[0]?.ok}`);
  }

  // 4. Add the column (now that blockers are gone)
  const col = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'is_dispatch_ready';
  `);

  if (col.rows.length > 0) {
    console.log('\nColumn is_dispatch_ready already exists.');
  } else {
    console.log('\nAdding is_dispatch_ready column...');
    await client.query(`
      ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS is_dispatch_ready BOOLEAN NOT NULL DEFAULT false;
    `);
    console.log('Column added.');
  }

  // 5. Record migration
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

  console.log('\nDone. Restart the API (npm run dev) if it is still erroring.');
} catch (err) {
  console.error('Failed:', err.message);
  process.exit(1);
} finally {
  await client.end().catch(() => undefined);
}

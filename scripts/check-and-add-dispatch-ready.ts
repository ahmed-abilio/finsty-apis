/**
 * One-off: verify is_dispatch_ready column and add it if missing.
 * Stop the API and any stuck `npm run migrate` before running:
 *   npx ts-node -r tsconfig-paths/register scripts/check-and-add-dispatch-ready.ts
 */
import 'dotenv/config';
import { Sequelize } from 'sequelize';

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

async function main(): Promise<void> {
  const sequelize = new Sequelize({
    dialect: 'postgres',
    host: DB_HOST,
    port: parseInt(DB_PORT, 10),
    database: DB_NAME,
    username: DB_USER,
    password: DB_PASSWORD,
    logging: console.log,
    pool: { max: 1, min: 0, acquire: 15000, idle: 5000 },
    dialectOptions: useDbSsl
      ? { ssl: { require: true, rejectUnauthorized: false } }
      : {},
  });

  try {
    await sequelize.authenticate();
    console.log('Connected.');

    const [cols] = await sequelize.query<{ column_name: string }>(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'orders' AND column_name = 'is_dispatch_ready';
    `);

    if (cols.length > 0) {
      console.log('Column is_dispatch_ready already exists.');
    } else {
      console.log('Adding is_dispatch_ready column...');
      await sequelize.query(`
        ALTER TABLE orders
        ADD COLUMN IF NOT EXISTS is_dispatch_ready BOOLEAN NOT NULL DEFAULT false;
      `);
      console.log('Column added.');
    }

    const [pending] = await sequelize.query<{ migration: string }>(`
      SELECT name AS migration
      FROM "SequelizeMeta"
      WHERE name = '20260703120000-add-is-dispatch-ready-to-orders.js';
    `);

    if (pending.length === 0) {
      await sequelize.query(`
        INSERT INTO "SequelizeMeta" (name)
        VALUES ('20260703120000-add-is-dispatch-ready-to-orders.js');
      `);
      console.log('Recorded migration in SequelizeMeta.');
    } else {
      console.log('Migration already recorded in SequelizeMeta.');
    }
  } finally {
    await sequelize.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

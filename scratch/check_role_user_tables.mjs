import 'dotenv/config';
import { Sequelize } from 'sequelize';

const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  dialect: 'postgres',
  logging: false,
});

await sequelize.authenticate();

for (const table of ['users', 'user_users', 'admin_users', 'vendor_users']) {
  try {
    const [[row]] = await sequelize.query(`SELECT COUNT(*)::int AS count FROM "${table}"`);
    console.log(`${table}: ${row.count}`);
  } catch {
    console.log(`${table}: missing`);
  }
}

const [migrations] = await sequelize.query(`
  SELECT name FROM "SequelizeMeta"
  WHERE name LIKE '%role%' OR name LIKE '%605201%'
  ORDER BY name
`);
console.log('role migrations:', migrations.map((m) => m.name));

const [allMigrations] = await sequelize.query(`SELECT name FROM "SequelizeMeta" ORDER BY name`);
console.log('last migrations:', allMigrations.slice(-8).map((m) => m.name));

const [roles] = await sequelize.query(`SELECT role, COUNT(*)::int AS count FROM "users" GROUP BY role ORDER BY role`);
console.log('users by role:', roles);

await sequelize.close();

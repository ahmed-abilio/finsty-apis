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
  const [[row]] = await sequelize.query(`SELECT COUNT(*)::int AS count FROM "${table}"`);
  console.log(`${table}: ${row.count}`);
}

const [orphans] = await sequelize.query(`
  SELECT c.user_id, u.role, u.phone
  FROM carts c
  LEFT JOIN user_users uu ON c.user_id = uu.id
  LEFT JOIN users u ON c.user_id = u.id
  WHERE c.user_id IS NOT NULL AND uu.id IS NULL;
`);
console.log('cart orphans:', orphans);

await sequelize.close();

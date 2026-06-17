import 'dotenv/config';
import { Sequelize } from 'sequelize';

const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  dialect: 'postgres',
  logging: false,
});

await sequelize.authenticate();

const [fkRows] = await sequelize.query(`
  SELECT
    con.conname AS constraint_name,
    nsp.nspname AS schema_name,
    rel.relname AS table_name,
    pg_get_constraintdef(con.oid) AS constraint_def
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  JOIN pg_class ref ON ref.oid = con.confrelid
  JOIN pg_namespace ref_nsp ON ref_nsp.oid = ref.relnamespace
  WHERE con.contype = 'f'
    AND ref.relname = 'users'
    AND ref_nsp.nspname = 'public';
`);

console.log('fk count', fkRows.length);
for (const row of fkRows) {
  console.log(row.table_name, row.constraint_name, row.constraint_def);
}

await sequelize.close();

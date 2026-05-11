const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');
dotenv.config();

const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  dialect: 'postgres',
  logging: false,
});

async function migrate() {
  try {
    await sequelize.authenticate();
    console.log('Altering "brands" table...');
    await sequelize.query('ALTER TABLE brands ALTER COLUMN logo_url TYPE TEXT');
    console.log('Successfully altered logo_url to TEXT');
    await sequelize.close();
  } catch (err) {
    console.error('Error altering table:', err);
    process.exit(1);
  }
}

migrate();

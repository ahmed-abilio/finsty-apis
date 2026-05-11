const { Sequelize, DataTypes } = require('sequelize');
const dotenv = require('dotenv');
dotenv.config();

const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  dialect: 'postgres',
  logging: false,
});

async function checkTable() {
  try {
    await sequelize.authenticate();
    const [results] = await sequelize.query("SELECT column_name, data_type, character_maximum_length FROM information_schema.columns WHERE table_name = 'brands'");
    console.log('Columns in "brands" table:');
    console.table(results);
    await sequelize.close();
  } catch (err) {
    console.error('Error checking table:', err);
    process.exit(1);
  }
}

checkTable();

// Used by sequelize-cli (must be plain JS)
require('dotenv').config();

module.exports = {
  development: {
    username: process.env.DB_USER || 'finsty_user',
    password: process.env.DB_PASSWORD || 'finsty_password',
    database: process.env.DB_NAME || 'finsty_db',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    dialect: 'postgres',
    logging: false,
  },
  test: {
    username: process.env.DB_USER || 'finsty_user',
    password: process.env.DB_PASSWORD || 'finsty_password',
    database: process.env.DB_NAME + '_test' || 'finsty_db_test',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    dialect: 'postgres',
    logging: false,
  },
  production: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
  },
};

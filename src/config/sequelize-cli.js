// Used by sequelize-cli (must be plain JS)
require('dotenv').config();

const useDbSsl =
  process.env.DB_SSL === 'true' ||
  (process.env.NODE_ENV === 'production' && process.env.DB_SSL !== 'false');

const sslDialectOptions = useDbSsl
  ? {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    }
  : {};

const baseConfig = {
  username: process.env.DB_USER || 'finsty_user',
  password: process.env.DB_PASSWORD || 'finsty_password',
  database: process.env.DB_NAME || 'finsty_db',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  dialect: 'postgres',
  logging: false,
  dialectOptions: sslDialectOptions,
};

module.exports = {
  development: baseConfig,
  test: {
    ...baseConfig,
    database: process.env.DB_NAME + '_test' || 'finsty_db_test',
  },
  production: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    dialect: 'postgres',
    logging: false,
    dialectOptions: sslDialectOptions,
  },
};

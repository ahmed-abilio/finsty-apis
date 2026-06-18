import { Sequelize } from 'sequelize';
import 'dotenv/config';

const {
  DB_HOST = 'localhost',
  DB_PORT = '5432',
  DB_NAME = 'finsty_db',
  DB_USER = 'finsty_user',
  DB_PASSWORD = 'admin',
  DB_POOL_MIN = '2',
  DB_POOL_MAX = '10',
  DB_POOL_ACQUIRE = '30000',
  DB_POOL_IDLE = '10000',
  DB_LOGGING = 'false',
  DB_SSL,
  NODE_ENV,
} = process.env;

const useDbSsl =
  DB_SSL === 'true' || (NODE_ENV === 'production' && DB_SSL !== 'false');

const sequelize = new Sequelize({
  dialect: 'postgres',
  host: DB_HOST,
  port: parseInt(DB_PORT, 10),
  database: DB_NAME,
  username: DB_USER,
  password: DB_PASSWORD,
  logging: DB_LOGGING === 'true' ? console.log : false,
  pool: {
    min: parseInt(DB_POOL_MIN, 10),
    max: parseInt(DB_POOL_MAX, 10),
    acquire: parseInt(DB_POOL_ACQUIRE, 10),
    idle: parseInt(DB_POOL_IDLE, 10),
  },
  define: {
    underscored: false,
    timestamps: true,
  },
  dialectOptions: useDbSsl
    ? {
        ssl: {
          require: true,
          rejectUnauthorized: false,
        },
      }
    : {},
});

export default sequelize;

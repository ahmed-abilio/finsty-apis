import Redis from 'ioredis';
import 'dotenv/config';

const {
  REDIS_HOST = 'localhost',
  REDIS_PORT = '6379',
  REDIS_PASSWORD,
  REDIS_DB = '0',
} = process.env;

const redisConfig = {
  host: REDIS_HOST,
  port: parseInt(REDIS_PORT, 10),
  db: parseInt(REDIS_DB, 10),
  ...(REDIS_PASSWORD ? { password: REDIS_PASSWORD } : {}),
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
  lazyConnect: true,
};

// Singleton for application use
const redis = new Redis(redisConfig);

redis.on('error', (err: Error) => {
  // Use process.stderr to avoid ESLint no-console; logger not yet initialized here
  process.stderr.write(`[Redis] Connection error: ${err.message}\n`);
});

redis.on('connect', () => {
  process.stdout.write('[Redis] Connected\n');
});

// Dedicated connection for BullMQ (it requires its own connection)
export function createBullMQConnection(): Redis {
  return new Redis(redisConfig);
}

export default redis;

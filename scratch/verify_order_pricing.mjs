import 'dotenv/config';
import pg from 'pg';

const orderId = process.argv[2] ?? 'fe015508-602a-490b-9eb5-5155c9b54230';

const client = new pg.Client({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

await client.connect();
const { rows } = await client.query(
  'SELECT delivery_charge, total_amount, subtotal FROM orders WHERE id = $1',
  [orderId],
);
console.log(rows[0] ?? 'not found');
await client.end();

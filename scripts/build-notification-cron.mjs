import fs from 'node:fs/promises';
import dotenv from 'dotenv';
import pg from 'pg';
import { deploymentCrons } from '../src/lib/server/notification-cron-config.js';

dotenv.config({ path: '.env', quiet: true });
const connection = process.env.DRUGSTORE_DATABASE_URL || process.env.DATABASE_URL;
if (!connection) throw new Error('Database connection required to build notification schedule');
const url = new URL(connection);
url.searchParams.delete('sslmode');
const client = new pg.Client({ connectionString: url.toString(), ssl: ['localhost', '127.0.0.1'].includes(url.hostname) ? false : { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 });
try {
  await client.connect();
  const { rows } = await client.query('SELECT notify_time FROM app_config WHERE id = TRUE');
  if (rows.length !== 1) throw new Error('Notification config missing');
  const path = '.vercel/output/config.json';
  const config = JSON.parse(await fs.readFile(path, 'utf8'));
  config.crons = deploymentCrons(rows[0].notify_time);
  await fs.writeFile(path, JSON.stringify(config, null, 2) + '\n');
  console.log('Notification schedule built for Asia/Bangkok:', rows[0].notify_time);
} finally {
  await client.end();
}

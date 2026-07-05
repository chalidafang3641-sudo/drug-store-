import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: '.env', quiet: true });
dotenv.config({ path: '.env.local', override: true, quiet: true });

const { Pool } = pg;
const rawConnectionString =
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.DATABASE_URL ||
  'postgres://localhost:5432/the_watcher';
const connectionUrl = new URL(rawConnectionString);

connectionUrl.searchParams.delete('sslmode');

const connectionString = connectionUrl.toString();
const isLocalConnection = ['localhost', '127.0.0.1', '::1'].includes(connectionUrl.hostname);
const poolMax = Number(process.env.PGPOOL_MAX || (isLocalConnection ? 10 : 1));

export const pool = new Pool({
  connectionString,
  ssl: isLocalConnection ? false : { rejectUnauthorized: false },
  max: Number.isFinite(poolMax) && poolMax > 0 ? poolMax : 1,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 5_000
});

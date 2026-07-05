import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: '.env', quiet: true });
dotenv.config({ path: '.env.local', override: true, quiet: true });

const { Pool } = pg;

function supabaseDirectConnectionString() {
  if (process.env.SUPABASE_DIRECT_DATABASE_URL) return process.env.SUPABASE_DIRECT_DATABASE_URL;
  const password = process.env.SUPABASE_DB_PASSWORD || '';
  if (!password) return '';

  const host = process.env.SUPABASE_DB_HOST || 'db.qvbqoxfuqzzffryqkuva.supabase.co';
  const port = process.env.SUPABASE_DB_PORT || '5432';
  const database = process.env.SUPABASE_DB_NAME || 'postgres';
  const user = process.env.SUPABASE_DB_USER || 'postgres';
  const encodedPassword = encodeURIComponent(password);

  return `postgresql://${user}:${encodedPassword}@${host}:${port}/${database}`;
}

const rawConnectionString =
  supabaseDirectConnectionString() ||
  process.env.POSTGRES_DIRECT_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL ||
  'postgres://localhost:5432/the_watcher';
const connectionUrl = new URL(rawConnectionString);

connectionUrl.searchParams.delete('sslmode');

const connectionString = connectionUrl.toString();
const isLocalConnection = ['localhost', '127.0.0.1', '::1'].includes(connectionUrl.hostname);
const poolMax = Number(process.env.PGPOOL_MAX || (isLocalConnection ? 10 : 1));
const remotePoolMaxUses = Number(process.env.PGPOOL_MAX_USES || 1);

export const pool = new Pool({
  connectionString,
  ssl: isLocalConnection ? false : { rejectUnauthorized: false },
  max: Number.isFinite(poolMax) && poolMax > 0 ? poolMax : 1,
  idleTimeoutMillis: isLocalConnection ? 10_000 : 1_000,
  connectionTimeoutMillis: 5_000,
  maxUses: isLocalConnection || !Number.isFinite(remotePoolMaxUses) ? Infinity : remotePoolMaxUses,
  allowExitOnIdle: !isLocalConnection
});

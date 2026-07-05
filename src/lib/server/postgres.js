import dotenv from 'dotenv';
import pg from 'pg';

const runtimeEnv = globalThis.process?.env || process.env;
const isVercelRuntime = runtimeEnv.VERCEL === '1' || Boolean(runtimeEnv.VERCEL_ENV);

dotenv.config({ path: '.env', quiet: true });
if (!isVercelRuntime) {
  dotenv.config({ path: '.env.local', override: true, quiet: true });
}

const { Pool } = pg;

function supabaseDirectConnectionString() {
  if (runtimeEnv.SUPABASE_DIRECT_DATABASE_URL) return runtimeEnv.SUPABASE_DIRECT_DATABASE_URL;
  if (isVercelRuntime) return '';

  const password = runtimeEnv.SUPABASE_DB_PASSWORD || '';
  if (!password) return '';

  const host = runtimeEnv.SUPABASE_DB_HOST || 'db.qvbqoxfuqzzffryqkuva.supabase.co';
  const port = runtimeEnv.SUPABASE_DB_PORT || '5432';
  const database = runtimeEnv.SUPABASE_DB_NAME || 'postgres';
  const user = runtimeEnv.SUPABASE_DB_USER || 'postgres';
  const encodedPassword = encodeURIComponent(password);

  return `postgresql://${user}:${encodedPassword}@${host}:${port}/${database}`;
}

function resolveConnection() {
  const connectionCandidates = [
    ['DRUGSTORE_DATABASE_URL', runtimeEnv.DRUGSTORE_DATABASE_URL],
    ['supabase_direct', supabaseDirectConnectionString()],
    ['POSTGRES_DIRECT_URL', runtimeEnv.POSTGRES_DIRECT_URL],
    ['POSTGRES_PRISMA_URL', runtimeEnv.POSTGRES_PRISMA_URL],
    ['POSTGRES_URL', runtimeEnv.POSTGRES_URL],
    ['POSTGRES_URL_NON_POOLING', runtimeEnv.POSTGRES_URL_NON_POOLING],
    ['DATABASE_URL', runtimeEnv.DATABASE_URL],
    ['local_default', 'postgres://localhost:5432/the_watcher']
  ];
  const [source, rawConnectionString] = connectionCandidates.find(([, value]) => value) || connectionCandidates.at(-1);
  const url = new URL(rawConnectionString);

  url.searchParams.delete('sslmode');

  return { source, url };
}

let poolInstance;

function getPool() {
  if (poolInstance) return poolInstance;

  const { source, url } = resolveConnection();
  const isLocalConnection = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  const poolMax = Number(runtimeEnv.PGPOOL_MAX || (isLocalConnection ? 10 : 1));
  const remotePoolMaxUses = Number(runtimeEnv.PGPOOL_MAX_USES || 1);
  poolInstance = new Pool({
    connectionString: url.toString(),
    ssl: isLocalConnection ? false : { rejectUnauthorized: false },
    max: Number.isFinite(poolMax) && poolMax > 0 ? poolMax : 1,
    idleTimeoutMillis: isLocalConnection ? 10_000 : 1_000,
    connectionTimeoutMillis: 5_000,
    maxUses: isLocalConnection || !Number.isFinite(remotePoolMaxUses) ? Infinity : remotePoolMaxUses,
    allowExitOnIdle: !isLocalConnection
  });

  return poolInstance;
}

export const pool = new Proxy({}, {
  get(_target, prop) {
    const value = getPool()[prop];
    return typeof value === 'function' ? value.bind(getPool()) : value;
  }
});

import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const runtimeEnv = globalThis.process?.env || process.env;
const isVercelRuntime = runtimeEnv.VERCEL === '1' || Boolean(runtimeEnv.VERCEL_ENV);

dotenv.config({ path: '.env', quiet: true });
if (!isVercelRuntime) {
  dotenv.config({ path: '.env.local', override: true, quiet: true });
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const rootDir = path.resolve(__dirname, '../../..');
export const uploadDir = path.join(rootDir, 'uploads');
export const PORT = Number(runtimeEnv.PORT || 3000);
export const PUBLIC_BASE_URL = (runtimeEnv.PUBLIC_BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
export const SESSION_HOURS = 8;

const SUPABASE_URL = runtimeEnv.SUPABASE_URL || runtimeEnv.PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = runtimeEnv.SUPABASE_SERVICE_ROLE_KEY || '';

export const supabaseAdmin = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  : null;

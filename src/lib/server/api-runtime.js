import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

import { pingDatabase } from '../src/lib/server/keepalive.js';
import { pool } from '../src/lib/server/postgres.js';

try {
  const result = await pingDatabase();
  console.log(JSON.stringify(result, null, 2));
} finally {
  await pool.end();
}

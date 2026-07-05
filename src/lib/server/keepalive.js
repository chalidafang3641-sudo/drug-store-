import { pool } from './postgres.js';

export async function pingDatabase() {
  const startedAt = Date.now();
  const { rows } = await pool.query('select now() as checked_at');

  return {
    ok: true,
    checkedAt: rows[0]?.checked_at,
    durationMs: Date.now() - startedAt
  };
}

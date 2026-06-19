import { handleApiPayload } from '../../server/index.js';

export async function load() {
  const [branding, locations, drugs] = await Promise.all([
    handleApiPayload({ action: 'branding' }),
    countRows('locations', 'active'),
    countRows('drugs', 'active')
  ]);

  return {
    branding: branding.branding ?? {},
    counts: {
      locations,
      drugs,
      activeItems: await countRows('items', "status = 'active' AND qty > 0")
    }
  };
}

async function countRows(table, where) {
  const { pool } = await import('$lib/server/postgres.js');
  const allowed = new Map([
    ['locations', 'active'],
    ['drugs', 'active'],
    ['items', "status = 'active' AND qty > 0"]
  ]);

  if (allowed.get(table) !== where) {
    throw new Error('Unsupported count query');
  }

  const { rows } = await pool.query(`SELECT count(*)::int AS count FROM ${table} WHERE ${where}`);
  return rows[0]?.count ?? 0;
}

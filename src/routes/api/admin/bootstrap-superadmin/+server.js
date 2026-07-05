import { json } from '@sveltejs/kit';
import { pool } from '$lib/server/postgres.js';
import { ROLES } from '$lib/server/api-auth.js';

function unauthorized() {
  return json({ ok: false, message: 'Not found' }, { status: 404 });
}

function isAuthorized(request) {
  const secret = process.env.BOOTSTRAP_SECRET || '';
  const authHeader = request.headers.get('authorization') || '';

  return Boolean(secret) && authHeader === `Bearer ${secret}`;
}

export async function POST({ request }) {
  if (!isAuthorized(request)) return unauthorized();

  const username = process.env.BOOTSTRAP_SUPERADMIN_USERNAME || 'superadmin';
  const password = process.env.BOOTSTRAP_SUPERADMIN_PASSWORD || '';
  const name = process.env.BOOTSTRAP_SUPERADMIN_NAME || 'Super Admin';

  if (password.length < 8) {
    return json({ ok: false, message: 'Missing bootstrap password' }, { status: 400 });
  }

  const existing = await pool.query('SELECT id FROM app_users WHERE lower(username) = lower($1)', [username]);
  let action = 'created';

  if (existing.rows[0]) {
    action = 'updated';
    await pool.query(
      `UPDATE app_users
       SET username = $1,
           password_hash = crypt($2, gen_salt('bf')),
           role = 'admin',
           name = $3,
           permissions = $4,
           active = TRUE
       WHERE id = $5`,
      [username, password, name, ROLES.admin.permissions, existing.rows[0].id]
    );
  } else {
    await pool.query(
      `INSERT INTO app_users (username, password_hash, role, name, permissions, active)
       VALUES ($1, crypt($2, gen_salt('bf')), 'admin', $3, $4, TRUE)`,
      [username, password, name, ROLES.admin.permissions]
    );
  }

  const verified = await pool.query(
    `SELECT username, role, active, permissions, password_hash = crypt($2, password_hash) AS password_ok
     FROM app_users
     WHERE username = $1`,
    [username, password]
  );

  return json({
    ok: true,
    action,
    user: {
      username: verified.rows[0]?.username,
      role: verified.rows[0]?.role,
      active: verified.rows[0]?.active,
      permissions: verified.rows[0]?.permissions,
      passwordOk: verified.rows[0]?.password_ok
    }
  });
}

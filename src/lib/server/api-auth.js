import { pool } from './postgres.js';
import { SESSION_HOURS } from './api-runtime.js';

export const ROLES = {
  admin: { name: 'ผู้ดูแลระบบ', permissions: ['*'] },
  pharmacist: { name: 'เภสัชกร', permissions: ['stock', 'drug', 'exchange', 'receive', 'view'] },
  staff: { name: 'เจ้าหน้าที่', permissions: ['receive', 'view'] }
};

export async function guard(payload, perms, fn) {
  const user = await getSessionUser(payload.token);
  if (!user) return { status: 'error', code: 'AUTH', message: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' };
  if (!hasPerm(user, perms)) return { status: 'error', message: 'ไม่มีสิทธิ์ใช้งานส่วนนี้' };
  return fn(user);
}

export function hasPerm(user, perms) {
  const userPerms = user.permissions || [];
  if (userPerms.includes('*')) return true;
  return perms.some((perm) => perm !== '*' && userPerms.includes(perm));
}

export function publicUser(user) {
  return {
    username: user.username,
    name: user.name,
    role: user.role,
    permissions: user.permissions || []
  };
}

export async function apiLogin(username, password) {
  if (!username || !password) return { status: 'error', message: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' };
  const { rows } = await pool.query(
    `SELECT id, code_id, username, role, name, permissions, active
     FROM app_users
     WHERE username = $1 AND password_hash = crypt($2, password_hash)`,
    [String(username).trim(), String(password)]
  );
  const user = rows[0];
  if (!user || !user.active) return { status: 'error', message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' };
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000);
  const session = await pool.query(
    'INSERT INTO sessions (user_id, expires_at) VALUES ($1, $2) RETURNING code_id',
    [user.id, expiresAt]
  );
  await pool.query('UPDATE app_users SET last_login = now() WHERE id = $1', [user.id]);
  return { status: 'success', token: session.rows[0].code_id, user: publicUser(user) };
}

export async function apiLogout(token) {
  if (token) await pool.query('DELETE FROM sessions WHERE code_id = $1', [token]).catch(() => {});
  return { status: 'success', message: 'ออกจากระบบแล้ว' };
}

export async function getSessionUser(token) {
  if (!token) return null;
  const { rows } = await pool.query(
    `SELECT u.id, u.code_id, u.username, u.role, u.name, u.permissions, u.active
     FROM sessions s
     JOIN app_users u ON u.id = s.user_id
     WHERE s.code_id = $1 AND s.expires_at > now()`,
    [token]
  );
  return rows[0] && rows[0].active ? rows[0] : null;
}

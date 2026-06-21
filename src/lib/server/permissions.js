import { error, redirect } from '@sveltejs/kit';

export function hasPermission(user, permissions = []) {
  const granted = user?.permissions || [];
  if (granted.includes('*')) return true;
  return permissions.some((permission) => granted.includes(permission));
}

export function requireUser(locals) {
  if (!locals.user) {
    redirect(303, '/login');
  }
  return locals.user;
}

export function requirePermission(locals, permissions) {
  const user = requireUser(locals);
  if (!hasPermission(user, permissions)) {
    error(403, 'ไม่มีสิทธิ์ใช้งานส่วนนี้');
  }
  return user;
}

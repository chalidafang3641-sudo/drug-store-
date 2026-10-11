import { requirePermission } from '$lib/server/permissions.js';
import { readConfig } from '$lib/server/api-config.js';
import { notificationScheduleStatus } from '$lib/server/notification-schedule-sync.js';

export async function GET({ locals }) {
  requirePermission(locals, ['*']);
  return Response.json(await notificationScheduleStatus(await readConfig()), { headers: { 'cache-control': 'no-store' } });
}

import { readConfig, configOut } from '$lib/server/api-config.js';
import { pool } from '$lib/server/postgres.js';
import { dispatchScheduledNotifications } from '$lib/server/notification-schedule.js';
import { runNotificationDispatch } from '../../../../../server/index.js';

export async function POST({ request }) {
  return handleScheduledRequest(request, process.env.NOTIFY_SCHEDULE_SECRET, 'cloudflare');
}

export async function GET() {
  return Response.json({ ok: false }, { status: 405, headers: { allow: 'POST' } });
}

async function handleScheduledRequest(request, secret, source) {
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ ok: false }, { status: 401 });
  }
  try {
    const config = configOut(await readConfig(), false).notification;
    const slot = request.headers.get('x-notification-slot');
    const day = new Date(Date.now() + 7 * 3600000).toISOString().slice(0,10);
    if (slot !== day + 'T' + config.notify_time) return Response.json({ok:true, results:[]});
    await pool.query('UPDATE app_config SET notification_scheduler_last_tick = now() WHERE id = TRUE');
    const result = await dispatchScheduledNotifications({
      config,
      query: (sql, params) => pool.query(sql, params),
      dispatch: (channel) => runNotificationDispatch({ channel })
    });
    console.info('Scheduled notifications', { source, ...result });
    return Response.json(result, { status: result.ok ? 200 : 502 });
  } catch {
    console.error('Scheduled notifications failed');
    return Response.json({ ok: false }, { status: 500 });
  }
}

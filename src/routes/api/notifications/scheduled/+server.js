import { readConfig, configOut } from '$lib/server/api-config.js';
import { pool } from '$lib/server/postgres.js';
import { dispatchScheduledNotifications } from '$lib/server/notification-schedule.js';
import { runNotificationDispatch } from '../../../../../server/index.js';

export async function POST({ request }) {
  const secret = process.env.NOTIFY_SCHEDULE_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ ok: false }, { status: 401 });
  }
  try {
    const config = configOut(await readConfig(), false).notification;
    const result = await dispatchScheduledNotifications({
      config,
      query: (sql, params) => pool.query(sql, params),
      dispatch: (channel) => runNotificationDispatch({ channel })
    });
    console.info('Scheduled notifications', result);
    return Response.json(result, { status: result.ok ? 200 : 502 });
  } catch {
    console.error('Scheduled notifications failed');
    return Response.json({ ok: false }, { status: 500 });
  }
}

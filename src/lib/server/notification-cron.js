export function createNotificationCron({ dispatch, getSecret, log = console.info }) {
  return async function GET({ request }) {
    const secret = getSecret();
    if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
      return Response.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    try {
      const result = await dispatch();
      const ok = result.status === 'success';
      const skipped = Boolean(result.skipped);
      log('Evening notification cron', { ok, skipped });
      // Do not expose report contents or provider credentials in cron logs/responses.
      return Response.json({ ok, skipped }, { status: ok ? 200 : 502 });
    } catch {
      log('Evening notification cron', { ok: false, error: 'dispatch_failed' });
      return Response.json({ ok: false, message: 'Notification dispatch failed' }, { status: 500 });
    }
  };
}

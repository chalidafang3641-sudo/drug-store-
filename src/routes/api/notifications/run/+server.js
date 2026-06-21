import { json } from '@sveltejs/kit';
import { runNotificationDispatch } from '../../../../../server/index.js';

function readSecret(request, url) {
  return request.headers.get('x-notify-secret')
    || request.headers.get('x-cron-secret')
    || url.searchParams.get('secret')
    || '';
}

export async function POST({ request, url }) {
  const configuredSecret = process.env.NOTIFY_RUN_SECRET || process.env.CRON_SECRET || '';
  if (!configuredSecret) {
    return json({ status: 'error', message: 'ยังไม่ได้ตั้ง NOTIFY_RUN_SECRET' }, { status: 501 });
  }

  const providedSecret = readSecret(request, url);
  if (providedSecret !== configuredSecret) {
    return json({ status: 'error', message: 'ไม่ได้รับอนุญาต' }, { status: 401 });
  }

  const result = await runNotificationDispatch();
  return json(result, { status: result.status === 'success' ? 200 : 400 });
}

export const GET = POST;

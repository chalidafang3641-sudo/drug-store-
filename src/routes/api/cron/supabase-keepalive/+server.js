import { json } from '@sveltejs/kit';
import { pingDatabase } from '$lib/server/keepalive.js';

function isAuthorized(request) {
  const cronSecret = process.env.CRON_SECRET || '';
  const authHeader = request.headers.get('authorization') || '';

  return Boolean(cronSecret) && authHeader === `Bearer ${cronSecret}`;
}

export async function GET({ request }) {
  if (!isAuthorized(request)) {
    return json({ ok: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await pingDatabase();
    return json(result);
  } catch (error) {
    console.error('Supabase keepalive failed:', error);
    return json(
      {
        ok: false,
        message: 'Database keepalive failed'
      },
      { status: 500 }
    );
  }
}

export async function tick(env, fetcher = fetch) {
  if (!env.NOTIFY_SCHEDULE_SECRET) throw new Error('Scheduler secret missing');
  const url = new URL(env.NOTIFICATION_URL);
  if (url.protocol !== 'https:') throw new Error('HTTPS required');
  const response = await fetcher(url.href, {
    method: 'POST',
    headers: { authorization: `Bearer ${env.NOTIFY_SCHEDULE_SECRET}` },
    redirect: 'manual',
    signal: AbortSignal.timeout(45000)
  });
  if (!response.ok) throw new Error(`Notification endpoint HTTP ${response.status}`);
  const result = await response.json();
  if (result.ok !== true) throw new Error('Notification dispatch failed');
  console.info('Notification scheduler tick completed');
}

export default {
  async scheduled(_controller, env) {
    await tick(env);
  },
  fetch() {
    return new Response('Not found', { status: 404 });
  }
};

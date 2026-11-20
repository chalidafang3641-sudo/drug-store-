export async function tick(env, fetcher = fetch, slot = '') {
  if (!env.NOTIFY_SCHEDULE_SECRET) throw new Error('Scheduler secret missing');
  const url = new URL(env.NOTIFICATION_URL);
  if (url.protocol !== 'https:') throw new Error('HTTPS required');
  const response = await fetcher(url.href, {
    method: 'POST',
    headers: { authorization: `Bearer ${env.NOTIFY_SCHEDULE_SECRET}`, 'x-notification-slot': slot },
    redirect: 'manual',
    signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) throw new Error(`Notification endpoint HTTP ${response.status}`);
  const result = await response.json();
  if (result.ok !== true) throw new Error('Notification dispatch failed');
  console.info('Notification scheduler tick completed');
}

const dayMs = 86400000;
export function nextAlarm(time, now) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Invalid store time');
  const day = new Date(now + 7 * 3600000).toISOString().slice(0, 10);
  const today = Date.parse(day + 'T' + time + ':00+07:00');
  return today > now ? today : today + dayMs;
}

export class StoreSchedule {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }

  async config() {
    return this.env.DB.prepare('SELECT notify_time AS time, notification_enabled AS enabled FROM app_config WHERE id=1').first();
  }

  async schedule(config) {
    const next = config.enabled ? nextAlarm(config.time, Date.now()) : null;
    const storage = this.ctx.storage;
    await storage.transaction(async tx => {
      await tx.put('schedule', { time: config.time, next });
      if (next === null) await tx.deleteAlarm();
      else await tx.setAlarm(next);
    });
    return {state: next === null ? 'disabled' : 'active', time: config.time, next};
  }

  async fetch(request) {
    return this.ctx.blockConcurrencyWhile(async () => {
      if (request.method === 'POST') return Response.json(await this.schedule(await this.config()));
      const saved = await this.ctx.storage.get('schedule');
      const next = await this.ctx.storage.getAlarm();
      return Response.json({time:saved?.time, next, state:!saved || next !== saved.next ? 'unavailable' : next === null ? 'disabled' : 'active'});
    });
  }

  async alarm(info) {
    await this.ctx.blockConcurrencyWhile(async () => {
      const config = await this.config();
      const saved = await this.ctx.storage.get('schedule');
      const now = Date.now();
      if (saved?.next > now) {
        await this.ctx.storage.setAlarm(saved.next);
        return;
      }
      const localDay = ms => new Date(ms + 7 * 3600000).toISOString().slice(0,10);
      if (config.enabled && saved?.next && saved.time === config.time && localDay(saved.next) === localDay(now)) {
        try { await tick(this.env, fetch, localDay(now) + 'T' + saved.time); }
        catch (error) {
          if ((info?.retryCount ?? 0) < 6) throw error;
          console.error('Daily notification retries exhausted');
        }
      }
      await this.schedule(config);
    });
  }
}

export default {
  fetch(request, env) {
    if (!request || !env?.CONTROL_KEY || new URL(request.url).pathname !== '/schedule' ||
        !['GET','POST'].includes(request.method) ||
        request.headers.get('authorization') !== 'Bearer ' + env.CONTROL_KEY) return new Response(null,{status:404});
    return env.SCHEDULER.get(env.SCHEDULER.idFromName('drugstore')).fetch(request);
  }
};

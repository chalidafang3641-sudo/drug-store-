import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import worker, { tick, nextAlarm, StoreSchedule } from '../cloudflare/notification-cron/worker.js';

test('schedules Bangkok times and rolls a passed slot to tomorrow', () => {
  const now = Date.parse('2026-11-20T08:00:00+07:00');
  assert.equal(nextAlarm('08:01', now), now + 60000);
  assert.equal(nextAlarm('08:00', now), now + 86400000);
});

test('saving a changed time replaces the alarm and disabling clears it', async () => {
  let alarm, saved;
  const storage = {
    transaction: callback => callback(storage),
    put: (_, value) => { saved = value; },
    setAlarm: value => { alarm = value; },
    deleteAlarm: () => { alarm = null; }
  };
  const store = new StoreSchedule({ storage }, {});
  await store.schedule({ enabled: 1, time: '08:00' });
  const first = alarm;
  await store.schedule({ enabled: 1, time: '09:00' });
  assert.notEqual(alarm, first);
  assert.equal(saved.next, alarm);
  await store.schedule({ enabled: 0, time: '09:00' });
  assert.equal(alarm, null);
});

test('worker authenticates POST, refuses redirects and reports endpoint failures', async () => {
  const env = { NOTIFICATION_URL: 'https://example.com/api/notifications/scheduled', NOTIFY_SCHEDULE_SECRET: 'test-only' };
  await tick(env, async (_url, options) => {
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.authorization, 'Bearer test-only');
    assert.equal(options.redirect, 'manual');
    return Response.json({ ok: true, results: [] });
  });
  await assert.rejects(tick(env, async () => new Response('', { status: 401 })), /401/);
  await assert.rejects(tick(env, async () => new Response(null, { status: 302, headers: { location: 'https://example.org/' } })), /302/);
  await assert.rejects(tick(env, async () => Response.json({ ok: false })), /dispatch failed/);
  await assert.rejects(tick({ ...env, NOTIFY_SCHEDULE_SECRET: '' }), /secret missing/);
  assert.equal(worker.fetch().status, 404);
});

test('only Cloudflare schedules notifications; Vercel retains unrelated keepalives', () => {
  const vercel = JSON.parse(fs.readFileSync(new URL('../vercel.json', import.meta.url)));
  assert.equal(vercel.crons.length, 2);
  assert.ok(vercel.crons.every(job => !job.path.includes('notifications')));
  const cloudflare = JSON.parse(fs.readFileSync(new URL('../cloudflare/notification-cron/wrangler.jsonc', import.meta.url)));
  assert.deepEqual(cloudflare.triggers.crons, []);
  const source = fs.readFileSync(new URL('../server/index.js', import.meta.url), 'utf8');
  assert.ok(!source.includes('syncNotificationSchedule'));
});

test('settings saves synchronize the Worker while status reads do not change its alarm', async t => {
  const { notificationScheduleStatus } = await import('../src/lib/server/notification-schedule-sync.js');
  const methods = [];
  const config = { notify_time: '08:00', notification_enabled: true };
  t.mock.method(globalThis, 'fetch', async (_, options) => {
    methods.push(options.method);
    return Response.json({ state: 'active', time: '08:00' });
  });
  assert.equal((await notificationScheduleStatus(config, true)).state, 'active');
  assert.equal((await notificationScheduleStatus(config)).state, 'active');
  assert.equal((await notificationScheduleStatus({ ...config, notify_time: '09:00' })).state, 'unavailable');
  assert.deepEqual(methods, ['POST', 'GET', 'GET']);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { notificationScheduleStatus } from '../src/lib/server/notification-schedule-sync.js';
import worker, { tick } from '../cloudflare/notification-cron/worker.js';

test('reports fresh scheduler contact, not a deployment or successful message', () => {
  const now = new Date('2026-10-11T14:00:00Z');
  const config = { notify_time: '21:00' };
  assert.equal(notificationScheduleStatus(config, now).state, 'unavailable');
  config.notification_scheduler_last_tick = '2026-10-11T13:59:00Z';
  assert.equal(notificationScheduleStatus(config, now).state, 'active');
  config.notify_time = '22:00';
  assert.equal(notificationScheduleStatus(config, now).time, '22:00');
  config.notification_scheduler_last_tick = '2026-10-11T13:55:00Z';
  assert.equal(notificationScheduleStatus(config, now).state, 'unavailable');
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
  assert.deepEqual(cloudflare.triggers.crons, ['* * * * *']);
  const source = fs.readFileSync(new URL('../server/index.js', import.meta.url), 'utf8');
  assert.ok(!source.includes('syncNotificationSchedule'));
});

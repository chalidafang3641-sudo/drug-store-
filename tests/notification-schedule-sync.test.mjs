import test from 'node:test';
import assert from 'node:assert/strict';
import { deploymentCrons, notificationCron } from '../src/lib/server/notification-cron-config.js';
import { notificationScheduleStatus, syncNotificationSchedule } from '../src/lib/server/notification-schedule-sync.js';

test('converts Bangkok time, including UTC date rollover, to a single daily send job', () => {
  assert.equal(notificationCron('20:37').schedule, '37 13 * * *');
  assert.equal(notificationCron('00:10').schedule, '10 17 * * *');
  assert.equal(notificationCron('07:00').schedule, '0 0 * * *');
  assert.equal(deploymentCrons('20:37').length, 3);
  assert.throws(() => notificationCron('24:00'));
});

test('verifies active cron, queues changed config, and reports failures without claiming success', async () => {
  const originalFetch = globalThis.fetch;
  const keys = ['NOTIFY_VERCEL_TOKEN', 'NOTIFY_VERCEL_PROJECT_ID', 'NOTIFY_VERCEL_TEAM_ID'];
  const originalEnv = keys.map((key) => process.env[key]);
  keys.forEach((key) => { process.env[key] = 'test'; });
  const queries = [];
  const posts = [];
  let time = '20:37';
  globalThis.fetch = async (url, options) => {
    if (options.method === 'POST') {
      posts.push(JSON.parse(options.body));
      return Response.json({ id: 'dpl_new' });
    }
    return Response.json({ name: 'drug-store', crons: { deploymentId: 'dpl_current', definitions: deploymentCrons(time), disabledAt: null } });
  };
  try {
    assert.equal((await syncNotificationSchedule({ notify_time: '20:37' }, async () => {})).state, 'active');
    assert.equal(posts.length, 0);
    const result = await syncNotificationSchedule({ notify_time: '21:15' }, async (...args) => queries.push(args));
    assert.equal(result.state, 'pending');
    assert.equal(posts[0].deploymentId, 'dpl_current');
    assert.equal(posts[0].target, 'production');
    assert.deepEqual(queries[0][1], ['dpl_new', '21:15']);
    time = '21:15';
    assert.equal((await notificationScheduleStatus({ notify_time: '21:15' })).state, 'active');
    globalThis.fetch = async () => new Response('', { status: 403 });
    assert.equal((await syncNotificationSchedule({ notify_time: '22:00' }, async () => {})).state, 'failed');
  } finally {
    globalThis.fetch = originalFetch;
    keys.forEach((key, i) => { if (originalEnv[i] === undefined) delete process.env[key]; else process.env[key] = originalEnv[i]; });
  }
});

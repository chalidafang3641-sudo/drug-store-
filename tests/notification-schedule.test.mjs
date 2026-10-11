import test from 'node:test';
import assert from 'node:assert/strict';
import { dueNotificationChannels, dispatchScheduledNotifications } from '../src/lib/server/notification-schedule.js';

const config = { enabled: true, notify_time: '17:00', telegram_enabled: true, line_enabled: true };
test('uses Bangkok config time and independently enabled channels', () => {
  assert.deepEqual(dueNotificationChannels(config, new Date('2026-10-11T09:59:00Z')).channels, []);
  assert.deepEqual(dueNotificationChannels(config, new Date('2026-10-11T10:00:00Z')), { day: '2026-10-11', channels: ['line', 'telegram'] });
  assert.deepEqual(dueNotificationChannels({ ...config, line_enabled: false }, new Date('2026-10-11T11:00:00Z')).channels, ['telegram']);
  assert.deepEqual(dueNotificationChannels({ ...config, enabled: false }).channels, []);
  assert.deepEqual(dueNotificationChannels({ ...config, notify_time: 'bad' }).channels, []);
});
test('isolates channel failures and does not resend claimed daily channels', async () => {
  const claims = new Set();
  const calls = [];
  const query = async (sql, [day, channel, time]) => {
    if (!sql.startsWith('INSERT')) return {};
    const key = `${day}/${channel}/${time}`;
    if (claims.has(key)) return { rowCount: 0 };
    claims.add(key);
    return { rowCount: 1 };
  };
  const options = { config, query, now: new Date('2026-10-11T10:00:00Z'), dispatch: async (channel) => {
    calls.push(channel);
    if (channel === 'line') throw new Error('offline');
    return { status: 'success' };
  } };
  assert.deepEqual((await dispatchScheduledNotifications(options)).results, [{ channel: 'line', status: 'failed' }, { channel: 'telegram', status: 'sent' }]);
  assert.deepEqual((await dispatchScheduledNotifications(options)).results, []);
  assert.deepEqual(calls, ['line', 'telegram']);
  await dispatchScheduledNotifications({ ...options, config: { ...config, notify_time: '17:05' }, now: new Date('2026-10-11T10:05:00Z') });
  assert.deepEqual(calls, ['line', 'telegram', 'line', 'telegram']);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Vercel notification jobs cover a full day within Hobby daily-job limits', () => {
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url)));
  assert.ok(config.crons.length <= 100);
  assert.equal(new Set(config.crons.map((job) => job.path)).size, config.crons.length);
  const jobs = config.crons.filter((job) => job.path.startsWith('/api/cron/notifications/'));
  assert.equal(jobs.length, 96);
  const slots = new Set();
  for (const job of jobs) {
    const [minute, hour, ...days] = job.schedule.split(' ');
    assert.deepEqual(days, ['*', '*', '*']);
    assert.ok(['0', '15', '30', '45'].includes(minute));
    assert.ok(/^\d+$/.test(hour) && Number(hour) < 24);
    assert.equal(job.path.split('/').at(-1), hour.padStart(2, '0') + minute.padStart(2, '0'));
    slots.add(`${hour}:${minute}`);
  }
  assert.equal(slots.size, 96);
});

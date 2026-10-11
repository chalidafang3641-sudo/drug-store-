import test from 'node:test';
import assert from 'node:assert/strict';
import { createNotificationCron } from '../src/lib/server/notification-cron.js';

const event = (secret = 'test-secret') => ({
  request: new Request('https://example.test/cron', {
    headers: { authorization: `Bearer ${secret}` }
  })
});

test('rejects invalid or unconfigured secrets without dispatching', async () => {
  for (const secret of ['', 'different']) {
    let calls = 0;
    const handler = createNotificationCron({
      getSecret: () => secret,
      dispatch: async () => { calls++; },
      log: () => {}
    });
    assert.equal((await handler(event())).status, 401);
    assert.equal(calls, 0);
  }
});

test('dispatches the saved channel and returns only safe status', async () => {
  let calls = 0;
  const handler = createNotificationCron({
    getSecret: () => 'test-secret',
    dispatch: async () => { calls++; return { status: 'success', text: 'private report' }; },
    log: () => {}
  });
  const response = await handler(event());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, skipped: false });
  assert.equal(calls, 1);
});

test('preserves disabled notifications and surfaces delivery failures', async () => {
  for (const [result, status, skipped] of [
    [{ status: 'success', skipped: true }, 200, true],
    [{ status: 'error', message: 'provider detail' }, 502, false]
  ]) {
    const handler = createNotificationCron({ getSecret: () => 'test-secret', dispatch: async () => result, log: () => {} });
    const response = await handler(event());
    assert.equal(response.status, status);
    assert.deepEqual(await response.json(), { ok: status === 200, skipped });
  }
});

test('handles exceptions without leaking secrets', async () => {
  const handler = createNotificationCron({
    getSecret: () => 'test-secret',
    dispatch: async () => { throw new Error('private credential'); },
    log: () => {}
  });
  const response = await handler(event());
  assert.equal(response.status, 500);
  assert.equal((await response.text()).includes('private credential'), false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { notificationExpiryWhere, splitNotificationText, validExpiryDays } from '../src/lib/server/notification-content.js';

test('expiry days accept zero and custom integers but reject malformed values', () => {
  for (const value of [0, 7, 30, 45, 3650]) assert.equal(validExpiryDays(value), true);
  for (const value of [-1, 3651, 1.5, NaN, null, '', '30']) assert.equal(validExpiryDays(value), false);
});

test('expiry query uses Bangkok date, inclusive boundaries and optional expired rows', () => {
  const sql = notificationExpiryWhere();
  assert.match(sql, /i.status = 'active' AND i.qty > 0/);
  assert.match(sql, /expiry_date <= .*\+ \$1::int/);
  assert.match(sql, /\$2::boolean OR i.expiry_date >=/);
  assert.match(sql, /Asia\/Bangkok/);
});

test('long reports retain every character and stay within message limits', () => {
  for (const text of ['short', 'a'.repeat(18000), ('ยา Lot 123 😀\n').repeat(2000)]) {
    const parts = splitNotificationText(text);
    assert.equal(parts.join(''), text);
    assert.ok(parts.every((part) => part.length > 0 && part.length <= 4000));
    assert.ok(parts.every((part) => !/[\uD800-\uDBFF]$/.test(part)));
  }
});

test('notification dispatch does not reuse capped dashboard or truncate expiry items', () => {
  const source = readFileSync(new URL('../server/index.js', import.meta.url), 'utf8');
  const dispatch = source.slice(source.indexOf('export async function runNotificationDispatch'));
  assert.doesNotMatch(dispatch, /await apiGetDashboard\(/);
  assert.match(dispatch, /notification.expiry_days, notification.include_expired/);
  const message = source.slice(source.indexOf('export function buildNotificationMessage'), source.indexOf('async function sendTelegramMessage'));
  assert.doesNotMatch(message, /near.slice/);
});

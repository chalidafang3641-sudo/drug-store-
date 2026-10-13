import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { expiryNotificationSections, notificationExpiryWhere, splitNotificationText, validExpiryDays } from '../src/lib/server/notification-content.js';

test('manual test and scheduled messages have identical content', () => {
  const source = readFileSync(new URL('../server/index.js', import.meta.url), 'utf8');
  const formatter = source.slice(source.indexOf('function notificationLines'), source.indexOf('async function sendTelegramMessage')).replace('export function', 'function');
  const build = runInNewContext(`${formatter}; buildNotificationMessage`, { expiryNotificationSections });
  for (const near of [[], [{ days: 2, drug_name: 'Medicine', expiry_date: '2026-10-15', qty: 3 }]]) {
    const input = { hospitalName: 'Hospital', near, low: [{ name: 'Stock', total: 1, min_qty: 2 }] };
    const actual = build({ ...input, test: true });
    assert.equal(actual, build({ ...input, test: false }));
    assert.match(actual, /^Hospital - สรุปแจ้งเตือนยา/);
    assert.doesNotMatch(actual, /ทดสอบ|เชื่อมต่อสำเร็จ/);
  }
});

test('expiry sections have independent counts and ascending expiry order without mutating input', () => {
  const items = [30, -1, 0, -10, 2].map((days) => ({ days, drug_name: `drug${days}`, expiry_date: '2026-10-13', qty: 12, lot_no: 'A', location_name: 'Shelf' }));
  const message = expiryNotificationSections(items);
  assert.match(message, /ใกล้หมดอายุ 3 รายการ/);
  assert.match(message, /หมดอายุแล้ว 2 รายการ/);
  assert.ok(message.indexOf('drug0') < message.indexOf('drug2'));
  assert.ok(message.indexOf('drug2') < message.indexOf('drug30'));
  assert.ok(message.indexOf('drug-10') < message.indexOf('drug-1 Lot'));
  assert.match(message, /หมดอายุวันนี้/);
  assert.match(message, /หมดอายุแล้ว 10 วัน/);
  assert.match(message, /คงเหลือ 12/);
  assert.deepEqual(items.map((item) => item.days), [30, -1, 0, -10, 2]);
  assert.equal(expiryNotificationSections([]), 'ใกล้หมดอายุ 0 รายการ\n\nหมดอายุแล้ว 0 รายการ');
});

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

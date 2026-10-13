import test from 'node:test';
import assert from 'node:assert/strict';
import { daysUntilExpiry } from '../src/lib/server/expiry-date.js';

test('expiry day changes at Bangkok midnight, not UTC midnight', () => {
  assert.equal(daysUntilExpiry('2026-10-14', new Date('2026-10-13T16:59:59Z')), 1);
  assert.equal(daysUntilExpiry('2026-10-14', new Date('2026-10-13T17:00:00Z')), 0);
  assert.equal(daysUntilExpiry('2026-10-13', new Date('2026-10-13T17:00:00Z')), -1);
  assert.equal(daysUntilExpiry('2026-10-14', new Date('2026-10-14T00:00:00Z')), 0);
});

test('reconciled expiry counts remain correct for October 13 in Thailand', () => {
  const now = new Date('2026-10-12T17:01:00Z');
  for (const [date, days] of [['2026-07-14', -91], ['2026-09-30', -13], ['2026-10-09', -4], ['2026-10-31', 18], ['2026-11-03', 21]]) {
    assert.equal(daysUntilExpiry(date, now), days);
  }
});

test('calendar boundaries handle leap days and new year', () => {
  assert.equal(daysUntilExpiry('2028-03-01', new Date('2028-02-28T17:00:00Z')), 1);
  assert.equal(daysUntilExpiry('2027-01-01', new Date('2026-12-31T17:00:00Z')), 0);
});

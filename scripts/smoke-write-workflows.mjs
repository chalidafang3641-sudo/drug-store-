import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config({ path: '.env', quiet: true });
dotenv.config({ path: '.env.local', override: true, quiet: true });

const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:3000/api';
const username = process.env.SMOKE_ADMIN_USER || 'admin';
const password = process.env.SMOKE_ADMIN_PASSWORD || 'admin1234';
const lotNo = process.env.SMOKE_LOT_NO || `SMOKE-${Date.now()}`;
const expiryDate = process.env.SMOKE_EXPIRY_DATE || '2099-12-31';
const createdItemIds = new Set();
const createdTransactionIds = new Set();

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required for smoke test cleanup.');
}
if (process.env.DATABASE_URL.includes('supabase.co') && process.env.SMOKE_ALLOW_REMOTE !== '1') {
  throw new Error('Refusing to run write smoke test against a Supabase remote unless SMOKE_ALLOW_REMOTE=1 is set.');
}
if (!/^SMOKE-[a-zA-Z0-9_-]+$/.test(lotNo)) {
  throw new Error('SMOKE_LOT_NO must start with SMOKE- and contain only letters, numbers, underscore, or dash.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslConfig(),
});

const result = {
  status: 'running',
  api_base_url: apiBaseUrl,
  lot_no: lotNo,
  steps: [],
  cleanup: {},
};

try {
  await assertNoPreexistingRows();

  const login = await api('login', { username, password });
  const token = login.token;
  step('login', { user: login.user?.username, role: login.user?.role });

  const [drugs, locations] = await Promise.all([
    api('getDrugs', { token }),
    api('getLocations', { token }),
  ]);
  const drug = (drugs.data || [])[0];
  const [fromLocation, toLocation] = locations.data || [];
  if (!drug || !fromLocation || !toLocation) {
    throw new Error('Smoke test requires at least 1 active drug and 2 active locations.');
  }
  step('fixtures', { drug: drug.name, from: fromLocation.name, to: toLocation.name });

  const receive = await api('receiveItem', {
    token,
    drug_id: drug.id,
    location_id: fromLocation.id,
    lot_no: lotNo,
    expiry_date: expiryDate,
    qty: 4,
    note: 'automated smoke test',
  });
  await rememberRows('after_receive');
  step('receiveItem', { item_id: receive.item?.id, qty: receive.item?.qty });

  const sourceItem = await findItem(token, lotNo, fromLocation.id);
  assert(sourceItem?.qty === 4, `Expected source qty 4 after receive, got ${sourceItem?.qty}`);

  const exchange = await api('exchangeItem', {
    token,
    item_id: sourceItem.id,
    to_location_id: toLocation.id,
    qty: 1,
  });
  await rememberRows('after_exchange');
  step('exchangeItem', { message: exchange.message });

  const sourceAfterExchange = await findItem(token, lotNo, fromLocation.id);
  const destItem = await findItem(token, lotNo, toLocation.id);
  assert(sourceAfterExchange?.qty === 3, `Expected source qty 3 after exchange, got ${sourceAfterExchange?.qty}`);
  assert(destItem?.qty === 1, `Expected destination qty 1 after exchange, got ${destItem?.qty}`);

  const adjust = await api('adjustItem', {
    token,
    item_id: destItem.id,
    actual_qty: 2,
    note: 'automated smoke test',
  });
  await rememberRows('after_adjust');
  step('adjustItem', { message: adjust.message });

  const destAfterAdjust = await findItem(token, lotNo, toLocation.id);
  assert(destAfterAdjust?.qty === 2, `Expected destination qty 2 after adjust, got ${destAfterAdjust?.qty}`);

  const dispose = await api('disposeItem', {
    token,
    item_id: destAfterAdjust.id,
    qty: 1,
    reason: 'อื่นๆ',
    note: 'automated smoke test',
  });
  await rememberRows('after_dispose');
  step('disposeItem', { message: dispose.message });

  const destAfterDispose = await findItem(token, lotNo, toLocation.id);
  assert(destAfterDispose?.qty === 1, `Expected destination qty 1 after dispose, got ${destAfterDispose?.qty}`);

  await assertTransactions(lotNo);
  await cleanupCreatedRows();
  await assertClean(lotNo);

  result.status = 'success';
  console.log(JSON.stringify(result, null, 2));
} catch (err) {
  result.status = 'error';
  result.message = err.message;
  await rememberRows('failure_cleanup_snapshot').catch(() => {});
  await cleanupCreatedRows().catch((cleanupErr) => {
    result.cleanup_error = cleanupErr.message;
  });
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
} finally {
  await pool.end();
}

async function api(action, payload = {}) {
  const response = await fetch(apiBaseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await response.json();
  if (data.status === 'error') throw new Error(`${action}: ${data.message || data.code || 'unknown error'}`);
  return data;
}

async function findItem(token, lot, locationId) {
  const items = await api('getLocationItems', { token, location_id: locationId });
  return (items.data || []).find((item) => item.lot_no === lot) || null;
}

async function assertTransactions(lot) {
  const { rows } = await pool.query(
    `SELECT type, count(*)::int count
       FROM transactions
      WHERE lot_no = $1
      GROUP BY type
      ORDER BY type`,
    [lot],
  );
  const counts = Object.fromEntries(rows.map((row) => [row.type, row.count]));
  for (const type of ['adjust', 'dispose', 'exchange', 'receive']) {
    assert(counts[type] >= 1, `Expected at least one ${type} transaction for ${lot}.`);
  }
  step('transactions', counts);
}

async function assertNoPreexistingRows() {
  const { rows } = await pool.query(
    `SELECT
       (SELECT count(*)::int FROM items WHERE lot_no = $1) items,
       (SELECT count(*)::int FROM transactions WHERE lot_no = $1) transactions`,
    [lotNo],
  );
  assert(rows[0].items === 0 && rows[0].transactions === 0, `Smoke lot ${lotNo} already exists; aborting to avoid deleting real data.`);
}

async function rememberRows(label) {
  const [items, transactions] = await Promise.all([
    pool.query('SELECT id FROM items WHERE lot_no = $1', [lotNo]),
    pool.query('SELECT id FROM transactions WHERE lot_no = $1', [lotNo]),
  ]);
  for (const row of items.rows) createdItemIds.add(row.id);
  for (const row of transactions.rows) createdTransactionIds.add(row.id);
  step(label, { item_ids: items.rows.length, transaction_ids: transactions.rows.length });
}

async function cleanupCreatedRows() {
  let deletedTransactions = 0;
  let deletedItems = 0;
  if (createdTransactionIds.size) {
    const result = await pool.query('DELETE FROM transactions WHERE id = ANY($1::bigint[])', [[...createdTransactionIds]]);
    deletedTransactions = result.rowCount;
  }
  if (createdItemIds.size) {
    const result = await pool.query('DELETE FROM items WHERE id = ANY($1::bigint[])', [[...createdItemIds]]);
    deletedItems = result.rowCount;
  }
  result.cleanup.deleted_transactions = (result.cleanup.deleted_transactions || 0) + deletedTransactions;
  result.cleanup.deleted_items = (result.cleanup.deleted_items || 0) + deletedItems;
}

async function assertClean(lot) {
  const { rows } = await pool.query(
    `SELECT
       (SELECT count(*)::int FROM items WHERE lot_no = $1) items,
       (SELECT count(*)::int FROM transactions WHERE lot_no = $1) transactions`,
    [lot],
  );
  assert(rows[0].items === 0 && rows[0].transactions === 0, `Cleanup failed for ${lot}.`);
  step('cleanup', rows[0]);
}

function step(name, details = {}) {
  result.steps.push({ name, ...details });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sslConfig() {
  const value = process.env.PGSSL_REJECT_UNAUTHORIZED;
  if (value == null) return undefined;
  return { rejectUnauthorized: !['0', 'false', 'no'].includes(String(value).toLowerCase()) };
}

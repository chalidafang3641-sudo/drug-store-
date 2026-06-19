import 'dotenv/config';
import fs from 'node:fs/promises';
import { Pool } from 'pg';

const snapshotPath = process.env.LEGACY_SNAPSHOT || 'legacy-exports/legacy-snapshot-latest.json';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required to reconcile legacy data.');
}

const snapshot = JSON.parse(await fs.readFile(snapshotPath, 'utf8'));
const snapshotDate = dateOnly(snapshot.exported_at) || dateOnly(new Date().toISOString());
const snapshotDrugIds = new Set((snapshot.drugs || []).map((drug) => String(drug.id)));
const snapshotItemIds = new Set((snapshot.items || []).map((item) => String(item.id)));
const historyDrugIds = new Set((snapshot.history || []).map((tx) => String(tx.drug_id || '')).filter(Boolean));
const historyItemIds = new Set((snapshot.history || []).map((tx) => String(tx.item_id || '')).filter(Boolean));
const placeholderDrugIds = [...historyDrugIds].filter((id) => !snapshotDrugIds.has(id));
const placeholderItemIds = [...historyItemIds].filter((id) => !snapshotItemIds.has(id));
const expected = {
  active_locations: count(snapshot.locations),
  active_drugs: count(snapshot.drugs),
  active_items: count(snapshot.items),
  total_qty: sum(snapshot.items, 'qty'),
  transactions: count(snapshot.history),
  dashboard_near: count(snapshot.dashboard?.near),
  placeholder_drugs: placeholderDrugIds.length,
  placeholder_items: placeholderItemIds.length,
  transaction_null_drug_refs: 0,
  transaction_null_item_refs: 0,
  legacy_map_locations: count(snapshot.locations),
  legacy_map_drugs: count(snapshot.drugs) + placeholderDrugIds.length,
  legacy_map_items: count(snapshot.items) + placeholderItemIds.length,
  legacy_map_transactions: count(snapshot.history),
};
const informationalExpected = {
  users: count(snapshot.users),
};

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslConfig(),
});

try {
  const [counts, maps, config] = await Promise.all([
    queryOne(`
      SELECT
        (SELECT count(*)::int FROM locations WHERE active) active_locations,
        (SELECT count(*)::int FROM drugs WHERE active) active_drugs,
        (SELECT count(*)::int FROM items WHERE status = 'active' AND qty > 0) active_items,
        (SELECT coalesce(sum(qty), 0)::int FROM items WHERE status = 'active' AND qty > 0) total_qty,
        (SELECT count(*)::int FROM transactions) transactions,
        (SELECT count(*)::int
           FROM items
          WHERE status = 'active'
            AND qty > 0
            AND expiry_date <= $1::date + (
              SELECT expiry_medium_days FROM app_config WHERE id = TRUE
            ) * interval '1 day') dashboard_near,
        (SELECT count(*)::int FROM drugs
          WHERE active = FALSE
            AND id IN (
              SELECT target_id FROM legacy_id_map
              WHERE source_system = 'google_apps_script'
                AND target_table = 'drugs'
                AND payload->>'source' = 'transaction_placeholder'
            )) placeholder_drugs,
        (SELECT count(*)::int FROM items
          WHERE status <> 'active'
            AND closed_reason = 'legacy_transaction_placeholder'
            AND id IN (
              SELECT target_id FROM legacy_id_map
              WHERE source_system = 'google_apps_script'
                AND target_table = 'items'
                AND payload->>'source' = 'transaction_placeholder'
            )) placeholder_items,
        (SELECT count(*)::int FROM transactions WHERE drug_id IS NULL) transaction_null_drug_refs,
        (SELECT count(*)::int FROM transactions WHERE item_id IS NULL) transaction_null_item_refs,
        (SELECT count(*)::int FROM legacy_id_map WHERE source_system = 'google_apps_script' AND target_table = 'locations') legacy_map_locations,
        (SELECT count(*)::int FROM legacy_id_map WHERE source_system = 'google_apps_script' AND target_table = 'drugs') legacy_map_drugs,
        (SELECT count(*)::int FROM legacy_id_map WHERE source_system = 'google_apps_script' AND target_table = 'items') legacy_map_items,
        (SELECT count(*)::int FROM legacy_id_map WHERE source_system = 'google_apps_script' AND target_table = 'transactions') legacy_map_transactions,
        (SELECT count(*)::int FROM app_users) users
    `, [snapshotDate]),
    query(`
      SELECT target_table, count(*)::int count
        FROM legacy_id_map
       WHERE source_system = 'google_apps_script'
       GROUP BY target_table
       ORDER BY target_table
    `),
    queryOne(`
      SELECT c.hospital_name,
             c.logo_file_id,
             c.expiry_critical_days,
             c.expiry_high_days,
             c.expiry_medium_days,
             l.code_id AS default_location_code_id,
             l.name AS default_location_name
        FROM app_config c
        LEFT JOIN locations l ON l.id = c.default_receive_location_id
       WHERE c.id = TRUE
    `),
  ]);

  const checks = Object.fromEntries(
    Object.entries(expected).map(([key, expectedValue]) => [
      key,
      {
        expected: expectedValue,
        actual: counts[key],
        ok: expectedValue === counts[key],
      },
    ]),
  );
  const informational = Object.fromEntries(
    Object.entries(informationalExpected).map(([key, expectedValue]) => [
      key,
      {
        expected: expectedValue,
        actual: counts[key],
        ok: expectedValue === counts[key],
      },
    ]),
  );

  const mapCounts = Object.fromEntries(maps.map((row) => [row.target_table, row.count]));
  const result = {
    status: Object.values(checks).every((check) => check.ok) ? 'success' : 'mismatch',
    snapshot: snapshotPath,
    exported_at: snapshot.exported_at,
    snapshot_date: snapshotDate,
    checks,
    informational,
    legacy_maps: mapCounts,
    config,
    notes: [
      'users are informational because legacy passwords are not migrated unless LEGACY_IMPORT_USERS is enabled',
      'dashboard_near uses snapshot_date and app_config expiry_medium_days',
    ],
  };

  console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'success') process.exitCode = 1;
} finally {
  await pool.end();
}

async function query(sql, params = []) {
  const { rows } = await pool.query(sql, params);
  return rows;
}

async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || {};
}

function count(value) {
  return Array.isArray(value) ? value.length : 0;
}

function sum(rows, field) {
  return (rows || []).reduce((total, row) => total + Number(row[field] || 0), 0);
}

function dateOnly(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function sslConfig() {
  const value = process.env.PGSSL_REJECT_UNAUTHORIZED;
  if (value == null) return undefined;
  return { rejectUnauthorized: !['0', 'false', 'no'].includes(String(value).toLowerCase()) };
}

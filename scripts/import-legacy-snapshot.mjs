import 'dotenv/config';
import fs from 'node:fs/promises';
import { Pool } from 'pg';

const snapshotPath = process.env.LEGACY_SNAPSHOT || 'legacy-exports/legacy-snapshot-latest.json';
const dryRun = boolEnv('LEGACY_IMPORT_DRY_RUN', process.argv.includes('--dry-run'));
const importUsers = boolEnv('LEGACY_IMPORT_USERS', false);
const syncLocations = boolEnv('LEGACY_IMPORT_SYNC_LOCATIONS', false);
const sourceSystem = process.env.LEGACY_SOURCE_SYSTEM || 'google_apps_script';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required to import legacy data.');
}

const snapshot = JSON.parse(await fs.readFile(snapshotPath, 'utf8'));
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslConfig(),
});
const client = await pool.connect();

const stats = {
  dry_run: dryRun,
  snapshot: snapshotPath,
  config: 0,
  locations: { source: count(snapshot.locations), upserted: 0, inactive: 0 },
  drugs: { source: count(snapshot.drugs), upserted: 0, placeholders: 0 },
  items: { source: count(snapshot.items), upserted: 0, placeholders: 0 },
  transactions: { source: count(snapshot.history), upserted: 0, placeholder_item_refs: 0 },
  users: { source: count(snapshot.users), upserted: 0, skipped: 0 },
};

try {
  await client.query('BEGIN');

  const locationIds = await importLocations();
  await importConfig(locationIds);
  const drugIds = await importDrugs(locationIds);
  const itemIds = await importItems(drugIds, locationIds);
  await importTransactions(drugIds, locationIds, itemIds);
  await importUsersIfEnabled();

  if (dryRun) {
    await client.query('ROLLBACK');
  } else {
    await client.query('COMMIT');
  }

  console.log(JSON.stringify({ status: 'success', ...stats }, null, 2));
} catch (err) {
  await client.query('ROLLBACK').catch(() => {});
  console.error(JSON.stringify({ status: 'error', message: err.message, ...stats }, null, 2));
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}

async function importConfig(locationIds) {
  const config = snapshot.config || {};
  const thresholds = config.expiry_thresholds || {};
  const notification = config.notification || {};
  const defaultLocationId = locationIds.get(stringOrEmpty(config.default_receive_location_id)) || null;

  await client.query(
    `UPDATE app_config
        SET hospital_name = $1,
            logo_file_id = CASE
              WHEN $16::boolean THEN $2
              WHEN logo_file_id LIKE '%/storage/v1/object/public/%' THEN logo_file_id
              ELSE $2
            END,
            folder_id = $3,
            expiry_critical_days = $4,
            expiry_high_days = $5,
            expiry_medium_days = $6,
            default_receive_location_id = $7,
            notification_enabled = $8,
            notification_channel = $9,
            telegram_bot_token = COALESCE(NULLIF($10, ''), telegram_bot_token),
            telegram_chat_id = COALESCE(NULLIF($11, ''), telegram_chat_id),
            line_token = COALESCE(NULLIF($12, ''), line_token),
            notify_time = $13,
            display_be = $14,
            app_version = $15
      WHERE id = TRUE`,
    [
      nonEmpty(config.hospital_name, 'โรงพยาบาลร้องกวาง'),
      stringOrEmpty(config.logo_file_id),
      stringOrEmpty(config.folder_id),
      numberOr(thresholds.critical, 35),
      numberOr(thresholds.high, 60),
      numberOr(thresholds.medium, 120),
      defaultLocationId,
      Boolean(notification.enabled),
      ['telegram', 'line'].includes(notification.channel) ? notification.channel : 'telegram',
      stringOrEmpty(notification.telegram_bot_token),
      stringOrEmpty(notification.telegram_chat_id),
      stringOrEmpty(notification.line_token),
      stringOrEmpty(notification.notify_time || '08:00'),
      Boolean(config.display_be),
      stringOrEmpty(config.app_version || '1.0'),
      boolEnv('LEGACY_IMPORT_OVERWRITE_LOGO', false),
    ],
  );

  stats.config = 1;
}

async function importLocations() {
  const targetIds = new Map();
  const importedIds = [];

  for (const location of snapshot.locations || []) {
    const legacyId = requiredId(location, 'locations');
    const existingId = await findMappedTarget('Locations', legacyId, 'locations')
      || await findIdByCode('locations', legacyId)
      || await findLocationByName(location.name);

    const row = await upsertLocation(existingId, legacyId, location);
    await upsertLegacyMap('Locations', legacyId, 'locations', row.id, row.code_id, location);
    targetIds.set(legacyId, row.id);
    importedIds.push(row.id);
    stats.locations.upserted += 1;
  }

  if (syncLocations && importedIds.length) {
    const result = await client.query(
      `UPDATE locations
          SET active = FALSE,
              is_default_receive = FALSE
        WHERE id <> ALL($1::bigint[])
          AND NOT EXISTS (
            SELECT 1
            FROM legacy_id_map m
            WHERE m.target_table = 'locations'
              AND m.target_id = locations.id
              AND m.source_system <> $2
          )`,
      [importedIds, sourceSystem],
    );
    stats.locations.inactive = result.rowCount;
  }

  return targetIds;
}

async function upsertLocation(existingId, legacyId, location) {
  const values = [
    legacyId,
    nonEmpty(location.name, 'ไม่ระบุชื่อสถานที่'),
    stringOrEmpty(location.icon || 'box'),
    stringOrEmpty(location.color || '#16A34A'),
    Boolean(location.is_default_receive),
    numberOr(location.sort_order, 0),
    location.active !== false,
    toDateOrNull(location.created_at),
    toDateOrNull(location.updated_at),
  ];

  if (existingId) {
    const { rows } = await client.query(
      `UPDATE locations
          SET code_id = $1,
              name = $2,
              icon = $3,
              color = $4,
              is_default_receive = $5,
              sort_order = $6,
              active = $7,
              created_at = COALESCE($8, created_at),
              updated_at = COALESCE($9, updated_at)
        WHERE id = $10
        RETURNING id, code_id`,
      [...values, existingId],
    );
    return rows[0];
  }

  const { rows } = await client.query(
    `INSERT INTO locations
      (code_id, name, icon, color, is_default_receive, sort_order, active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, now()), COALESCE($9, now()))
     ON CONFLICT (code_id) DO UPDATE
       SET name = EXCLUDED.name,
           icon = EXCLUDED.icon,
           color = EXCLUDED.color,
           is_default_receive = EXCLUDED.is_default_receive,
           sort_order = EXCLUDED.sort_order,
           active = EXCLUDED.active,
           updated_at = EXCLUDED.updated_at
     RETURNING id, code_id`,
    values,
  );
  return rows[0];
}

async function importDrugs(locationIds) {
  const targetIds = new Map();

  for (const drug of snapshot.drugs || []) {
    const legacyId = requiredId(drug, 'drugs');
    const defaultLocationId = locationIds.get(stringOrEmpty(drug.default_location_id)) || null;
    const existingId = await findMappedTarget('Drugs', legacyId, 'drugs')
      || await findIdByCode('drugs', legacyId);
    const row = await upsertDrug(existingId, legacyId, drug, defaultLocationId);
    await upsertLegacyMap('Drugs', legacyId, 'drugs', row.id, row.code_id, drug);
    targetIds.set(legacyId, row.id);
    stats.drugs.upserted += 1;
  }

  return targetIds;
}

async function upsertDrug(existingId, legacyId, drug, defaultLocationId) {
  const values = [
    legacyId,
    nonEmpty(drug.name, 'ไม่ระบุชื่อยา'),
    stringOrEmpty(drug.code),
    stringOrEmpty(drug.unit),
    Boolean(drug.require_lot),
    defaultLocationId,
    stringOrEmpty(drug.image_file_id),
    numberOr(drug.min_qty, 0),
    drug.active !== false,
    toDateOrNull(drug.created_at),
    toDateOrNull(drug.updated_at),
  ];

  if (existingId) {
    const { rows } = await client.query(
      `UPDATE drugs
          SET code_id = $1,
              name = $2,
              code = $3,
              unit = $4,
              require_lot = $5,
              default_location_id = $6,
              image_file_id = $7,
              min_qty = $8,
              active = $9,
              created_at = COALESCE($10, created_at),
              updated_at = COALESCE($11, updated_at)
        WHERE id = $12
        RETURNING id, code_id`,
      [...values, existingId],
    );
    return rows[0];
  }

  const { rows } = await client.query(
    `INSERT INTO drugs
      (code_id, name, code, unit, require_lot, default_location_id, image_file_id, min_qty, active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10, now()), COALESCE($11, now()))
     ON CONFLICT (code_id) DO UPDATE
       SET name = EXCLUDED.name,
           code = EXCLUDED.code,
           unit = EXCLUDED.unit,
           require_lot = EXCLUDED.require_lot,
           default_location_id = EXCLUDED.default_location_id,
           image_file_id = EXCLUDED.image_file_id,
           min_qty = EXCLUDED.min_qty,
           active = EXCLUDED.active,
           updated_at = EXCLUDED.updated_at
     RETURNING id, code_id`,
    values,
  );
  return rows[0];
}

async function importItems(drugIds, locationIds) {
  const targetIds = new Map();

  for (const item of snapshot.items || []) {
    const legacyId = requiredId(item, 'items');
    const drugId = drugIds.get(stringOrEmpty(item.drug_id));
    const locationId = locationIds.get(stringOrEmpty(item.location_id));
    if (!drugId || !locationId) {
      throw new Error(`Item ${legacyId} references missing drug/location.`);
    }

    const existingId = await findMappedTarget('Items', legacyId, 'items')
      || await findIdByCode('items', legacyId)
      || await findActiveItemByNaturalKey(drugId, locationId, item.lot_no, item.expiry_date);
    const row = await upsertItem(existingId, legacyId, item, drugId, locationId);
    await upsertLegacyMap('Items', legacyId, 'items', row.id, row.code_id, item);
    targetIds.set(legacyId, row.id);
    stats.items.upserted += 1;
  }

  return targetIds;
}

async function upsertItem(existingId, legacyId, item, drugId, locationId) {
  const values = [
    legacyId,
    drugId,
    locationId,
    stringOrEmpty(item.lot_no),
    requiredDate(item.expiry_date, `item ${legacyId}`),
    numberOr(item.qty, 0),
    'active',
    stringOrEmpty(item.by || item.received_by),
    toDateOrNull(item.received_at || item.created_at),
    stringOrEmpty(item.note),
  ];

  if (existingId) {
    const { rows } = await client.query(
      `UPDATE items
          SET code_id = $1,
              drug_id = $2,
              location_id = $3,
              lot_no = $4,
              expiry_date = $5,
              qty = $6,
              status = $7,
              closed_at = NULL,
              closed_reason = '',
              received_by = $8,
              received_at = COALESCE($9, received_at),
              note = $10
        WHERE id = $11
        RETURNING id, code_id`,
      [...values, existingId],
    );
    return rows[0];
  }

  const inserted = await client.query(
    `INSERT INTO items
      (code_id, drug_id, location_id, lot_no, expiry_date, qty, status, received_by, received_at, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, now()), $10)
     ON CONFLICT (code_id) DO UPDATE
       SET drug_id = EXCLUDED.drug_id,
           location_id = EXCLUDED.location_id,
           lot_no = EXCLUDED.lot_no,
           expiry_date = EXCLUDED.expiry_date,
           qty = EXCLUDED.qty,
           status = EXCLUDED.status,
           closed_at = NULL,
           closed_reason = '',
           received_by = EXCLUDED.received_by,
           received_at = EXCLUDED.received_at,
           note = EXCLUDED.note
     RETURNING id, code_id`,
    values,
  );
  if (inserted.rows[0]) return inserted.rows[0];

  const { rows } = await client.query(
    `UPDATE items
        SET code_id = $1,
            qty = $6,
            status = 'active',
            closed_at = NULL,
            closed_reason = '',
            received_by = $8,
            received_at = COALESCE($9, received_at),
            note = $10
      WHERE drug_id = $2
        AND location_id = $3
        AND lot_no = $4
        AND expiry_date = $5
        AND status = 'active'
      RETURNING id, code_id`,
    values,
  );
  if (!rows[0]) throw new Error(`Unable to upsert item ${legacyId}.`);
  return rows[0];
}

async function importTransactions(drugIds, locationIds, itemIds) {
  for (const tx of snapshot.history || []) {
    const legacyId = requiredId(tx, 'transactions');
    const drugId = await resolveTransactionDrug(tx, drugIds, locationIds);
    const itemId = await resolveTransactionItem(tx, itemIds, drugId, locationIds);

    const existingId = await findMappedTarget('Transactions', legacyId, 'transactions')
      || await findIdByCode('transactions', legacyId);
    const row = await upsertTransaction(existingId, legacyId, tx, {
      itemId,
      drugId,
      fromLocationId: locationIds.get(stringOrEmpty(tx.from_location_id)) || null,
      toLocationId: locationIds.get(stringOrEmpty(tx.to_location_id)) || null,
    });
    await upsertLegacyMap('Transactions', legacyId, 'transactions', row.id, row.code_id, tx);
    stats.transactions.upserted += 1;
  }
}

async function resolveTransactionDrug(tx, drugIds, locationIds) {
  const legacyId = stringOrEmpty(tx.drug_id);
  if (!legacyId) return null;
  const existing = drugIds.get(legacyId);
  if (existing) return existing;

  const mapped = await findMappedTarget('Drugs', legacyId, 'drugs') || await findIdByCode('drugs', legacyId);
  if (mapped) {
    drugIds.set(legacyId, mapped);
    return mapped;
  }

  const defaultLocationId = locationIds.get(stringOrEmpty(tx.to_location_id))
    || locationIds.get(stringOrEmpty(tx.from_location_id))
    || null;
  const row = await upsertDrug(null, legacyId, {
    id: legacyId,
    name: tx.drug_name || `Legacy drug ${legacyId}`,
    code: '',
    unit: '',
    require_lot: false,
    image_file_id: '',
    min_qty: 0,
    active: false,
    created_at: tx.created_at,
    updated_at: tx.created_at,
  }, defaultLocationId);
  await upsertLegacyMap('Drugs', legacyId, 'drugs', row.id, row.code_id, {
    id: legacyId,
    name: tx.drug_name || '',
    source: 'transaction_placeholder',
  });
  drugIds.set(legacyId, row.id);
  stats.drugs.placeholders += 1;
  return row.id;
}

async function resolveTransactionItem(tx, itemIds, drugId, locationIds) {
  const legacyId = stringOrEmpty(tx.item_id);
  if (!legacyId) return null;
  const existing = itemIds.get(legacyId);
  if (existing) return existing;

  const mapped = await findMappedTarget('Items', legacyId, 'items') || await findIdByCode('items', legacyId);
  if (mapped) {
    itemIds.set(legacyId, mapped);
    return mapped;
  }

  if (!drugId) {
    stats.transactions.placeholder_item_refs += 1;
    return null;
  }

  const locationId = locationIds.get(stringOrEmpty(tx.to_location_id))
    || locationIds.get(stringOrEmpty(tx.from_location_id));
  if (!locationId) {
    stats.transactions.placeholder_item_refs += 1;
    return null;
  }

  const status = tx.type === 'exchange' ? 'exchanged' : 'disposed';
  const row = await upsertClosedItemPlaceholder(legacyId, tx, drugId, locationId, status);
  await upsertLegacyMap('Items', legacyId, 'items', row.id, row.code_id, {
    ...tx,
    source: 'transaction_placeholder',
  });
  itemIds.set(legacyId, row.id);
  stats.items.placeholders += 1;
  stats.transactions.placeholder_item_refs += 1;
  return row.id;
}

async function upsertClosedItemPlaceholder(legacyId, tx, drugId, locationId, status) {
  const { rows } = await client.query(
    `INSERT INTO items
      (code_id, drug_id, location_id, lot_no, expiry_date, qty, status, closed_at, closed_reason, received_by, received_at, note)
     VALUES ($1, $2, $3, $4, $5, 0, $6, COALESCE($7, now()), 'legacy_transaction_placeholder', $8, COALESCE($7, now()), $9)
     ON CONFLICT (code_id) DO UPDATE
       SET drug_id = EXCLUDED.drug_id,
           location_id = EXCLUDED.location_id,
           lot_no = EXCLUDED.lot_no,
           expiry_date = EXCLUDED.expiry_date,
           qty = 0,
           status = EXCLUDED.status,
           closed_at = EXCLUDED.closed_at,
           closed_reason = EXCLUDED.closed_reason,
           received_by = EXCLUDED.received_by,
           note = EXCLUDED.note
     RETURNING id, code_id`,
    [
      legacyId,
      drugId,
      locationId,
      stringOrEmpty(tx.lot_no),
      placeholderExpiryDate(tx.expiry_date),
      status,
      toDateOrNull(tx.created_at),
      stringOrEmpty(tx.by || tx.by_username),
      legacyNote(tx),
    ],
  );
  return rows[0];
}

async function upsertTransaction(existingId, legacyId, tx, refs) {
  const type = ['receive', 'exchange', 'dispose', 'adjust'].includes(tx.type) ? tx.type : 'receive';
  const values = [
    legacyId,
    type,
    refs.itemId,
    refs.drugId,
    refs.fromLocationId,
    refs.toLocationId,
    numberOr(tx.qty, 0),
    stringOrEmpty(tx.lot_no),
    toDateOnlyOrNull(tx.expiry_date),
    stringOrEmpty(tx.reason),
    stringOrEmpty(tx.note),
    stringOrEmpty(tx.by || tx.by_username),
    toDateOrNull(tx.created_at),
  ];

  if (existingId) {
    const { rows } = await client.query(
      `UPDATE transactions
          SET code_id = $1,
              type = $2,
              item_id = $3,
              drug_id = $4,
              from_location_id = $5,
              to_location_id = $6,
              qty = $7,
              lot_no = $8,
              expiry_date = $9,
              reason = $10,
              note = $11,
              by_username = $12,
              created_at = COALESCE($13, created_at)
        WHERE id = $14
        RETURNING id, code_id`,
      [...values, existingId],
    );
    return rows[0];
  }

  const { rows } = await client.query(
    `INSERT INTO transactions
      (code_id, type, item_id, drug_id, from_location_id, to_location_id, qty, lot_no, expiry_date, reason, note, by_username, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, COALESCE($13, now()))
     ON CONFLICT (code_id) DO UPDATE
       SET type = EXCLUDED.type,
           item_id = EXCLUDED.item_id,
           drug_id = EXCLUDED.drug_id,
           from_location_id = EXCLUDED.from_location_id,
           to_location_id = EXCLUDED.to_location_id,
           qty = EXCLUDED.qty,
           lot_no = EXCLUDED.lot_no,
           expiry_date = EXCLUDED.expiry_date,
           reason = EXCLUDED.reason,
           note = EXCLUDED.note,
           by_username = EXCLUDED.by_username,
           created_at = EXCLUDED.created_at
     RETURNING id, code_id`,
    values,
  );
  return rows[0];
}

async function importUsersIfEnabled() {
  if (!importUsers) {
    stats.users.skipped = count(snapshot.users);
    return;
  }

  for (const user of snapshot.users || []) {
    const legacyId = requiredId(user, 'users');
    const existingId = await findMappedTarget('Users', legacyId, 'app_users')
      || await findIdByCode('app_users', legacyId);
    const row = await upsertUser(existingId, legacyId, user);
    await upsertLegacyMap('Users', legacyId, 'app_users', row.id, row.code_id, user);
    stats.users.upserted += 1;
  }
}

async function upsertUser(existingId, legacyId, user) {
  const role = ['admin', 'pharmacist', 'staff'].includes(user.role) ? user.role : 'staff';
  const permissions = permissionsFor(role);
  const active = existingId ? user.active === true && boolEnv('LEGACY_IMPORT_USERS_ACTIVE', false) : false;
  const username = existingId
    ? nonEmpty(user.username, `legacy_user_${legacyId.slice(0, 8)}`)
    : await availableLegacyUsername(user.username, legacyId);
  const values = [
    legacyId,
    username,
    role,
    nonEmpty(user.name, user.username || 'Legacy User'),
    permissions,
    active,
    toDateOrNull(user.last_login),
  ];

  if (existingId) {
    const { rows } = await client.query(
      `UPDATE app_users
          SET code_id = $1,
              username = $2,
              role = $3,
              name = $4,
              permissions = $5,
              active = $6,
              last_login = $7
        WHERE id = $8
        RETURNING id, code_id`,
      [...values, existingId],
    );
    return rows[0];
  }

  const { rows } = await client.query(
    `INSERT INTO app_users
      (code_id, username, password_hash, role, name, permissions, active, last_login)
     VALUES ($1, $2, crypt(gen_random_uuid()::text, gen_salt('bf')), $3, $4, $5, $6, $7)
     ON CONFLICT (code_id) DO UPDATE
       SET role = EXCLUDED.role,
           name = EXCLUDED.name,
           permissions = EXCLUDED.permissions,
           active = EXCLUDED.active,
           last_login = EXCLUDED.last_login
     RETURNING id, code_id`,
    values,
  );
  return rows[0];
}

async function findMappedTarget(sourceTable, legacyId, targetTable) {
  const { rows } = await client.query(
    `SELECT target_id
       FROM legacy_id_map
      WHERE source_system = $1
        AND source_table = $2
        AND legacy_id = $3
        AND target_table = $4
      LIMIT 1`,
    [sourceSystem, sourceTable, legacyId, targetTable],
  );
  return rows[0]?.target_id || null;
}

async function findIdByCode(table, codeId) {
  const { rows } = await client.query(`SELECT id FROM ${table} WHERE code_id = $1 LIMIT 1`, [codeId]);
  return rows[0]?.id || null;
}

async function findLocationByName(name) {
  if (!name) return null;
  const { rows } = await client.query(
    `SELECT id FROM locations WHERE lower(name) = lower($1) ORDER BY active DESC, id LIMIT 1`,
    [name],
  );
  return rows[0]?.id || null;
}

async function findActiveItemByNaturalKey(drugId, locationId, lotNo, expiryDate) {
  const date = toDateOnlyOrNull(expiryDate);
  if (!drugId || !locationId || !date) return null;
  const { rows } = await client.query(
    `SELECT id
       FROM items
      WHERE drug_id = $1
        AND location_id = $2
        AND lot_no = $3
        AND expiry_date = $4
        AND status = 'active'
      LIMIT 1`,
    [drugId, locationId, stringOrEmpty(lotNo), date],
  );
  return rows[0]?.id || null;
}

async function findUserByUsername(username) {
  if (!username) return null;
  const { rows } = await client.query(
    `SELECT id FROM app_users WHERE lower(username) = lower($1) ORDER BY active DESC, id LIMIT 1`,
    [username],
  );
  return rows[0]?.id || null;
}

async function availableLegacyUsername(username, legacyId) {
  const preferred = nonEmpty(username, `legacy_user_${legacyId.slice(0, 8)}`);
  const { rows } = await client.query(
    `SELECT 1 FROM app_users WHERE lower(username) = lower($1) LIMIT 1`,
    [preferred],
  );
  if (!rows[0]) return preferred;
  return `legacy_${preferred}_${legacyId.slice(0, 8)}`;
}

async function upsertLegacyMap(sourceTable, legacyId, targetTable, targetId, targetCodeId, payload) {
  await client.query(
    `INSERT INTO legacy_id_map
      (source_system, source_table, legacy_id, target_table, target_id, target_code_id, payload, imported_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, now())
     ON CONFLICT (source_system, source_table, legacy_id, target_table) DO UPDATE
       SET target_id = EXCLUDED.target_id,
           target_code_id = EXCLUDED.target_code_id,
           payload = EXCLUDED.payload,
           imported_at = now()`,
    [sourceSystem, sourceTable, legacyId, targetTable, targetId, targetCodeId || '', JSON.stringify(payload || {})],
  );
}

function count(value) {
  return Array.isArray(value) ? value.length : 0;
}

function boolEnv(name, fallback) {
  if (process.env[name] == null) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(process.env[name]).toLowerCase());
}

function requiredId(row, label) {
  const id = stringOrEmpty(row?.id);
  if (!id) throw new Error(`Missing legacy id in ${label}.`);
  return id;
}

function stringOrEmpty(value) {
  return value == null ? '' : String(value);
}

function nonEmpty(value, fallback) {
  const text = stringOrEmpty(value).trim();
  return text || fallback;
}

function numberOr(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function toDateOrNull(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toDateOnlyOrNull(value) {
  if (!value) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? String(value) : null;
}

function requiredDate(value, label) {
  const date = toDateOnlyOrNull(value);
  if (!date) throw new Error(`Missing or invalid expiry_date for ${label}.`);
  return date;
}

function permissionsFor(role) {
  if (role === 'admin') return ['*'];
  if (role === 'pharmacist') return ['stock', 'drug', 'exchange', 'receive', 'view'];
  return ['receive', 'view'];
}

function legacyNote(tx) {
  const parts = [];
  const note = stringOrEmpty(tx.note);
  if (note) parts.push(note);
  if (tx.drug_name) parts.push(`legacy_drug_name=${tx.drug_name}`);
  if (tx.from_location_name) parts.push(`legacy_from_location=${tx.from_location_name}`);
  if (tx.to_location_name) parts.push(`legacy_to_location=${tx.to_location_name}`);
  if (tx.reason) parts.push(`legacy_reason=${tx.reason}`);
  if (!toDateOnlyOrNull(tx.expiry_date)) parts.push('legacy_expiry_date_missing=true');
  return parts.join(' | ');
}

function placeholderExpiryDate(value) {
  return toDateOnlyOrNull(value) || '9999-12-31';
}

function sslConfig() {
  const value = process.env.PGSSL_REJECT_UNAUTHORIZED;
  if (value == null) return undefined;
  return { rejectUnauthorized: !['0', 'false', 'no'].includes(String(value).toLowerCase()) };
}

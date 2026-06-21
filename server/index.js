import cors from 'cors';
import express from 'express';
import { pathToFileURL } from 'node:url';
import {
  dateOnly,
  daysTo,
  exportName,
  fileUrl,
  itemSelectSql,
  logError,
  mapDrug,
  mapItem,
  mapItemWithNames,
  mapLocation,
  mapTransaction,
  now,
  resolveCodeId,
  rollbackResult,
  saveUpload,
  toIso,
  transactionSelectSql
} from '../src/lib/server/api-helpers.js';
import { apiLogin, apiLogout, guard, publicUser, ROLES } from '../src/lib/server/api-auth.js';
import { apiBranding, apiGetConfig, apiSaveConfig, configOut, readConfig } from '../src/lib/server/api-config.js';
import { PORT, PUBLIC_BASE_URL, rootDir, uploadDir } from '../src/lib/server/api-runtime.js';
import { pool } from '../src/lib/server/postgres.js';

const app = express();
app.use(cors());
app.use(express.text({ type: '*/*', limit: '12mb' }));
app.use('/uploads', express.static(uploadDir));
app.use(express.static(rootDir));

app.post('/api', async (req, res) => {
  let payload = {};
  try {
    payload = typeof req.body === 'string' && req.body ? JSON.parse(req.body) : {};
    res.json(await handleApiPayload(payload));
  } catch (err) {
    await logError('api', err);
    res.json({ status: 'error', message: `เกิดข้อผิดพลาด: ${err.message || err}` });
  }
});

app.get('/api', async (req, res) => {
  try {
    res.json(await handleApiPayload(req.query));
  } catch (err) {
    await logError('api:get', err);
    res.json({ status: 'error', message: `เกิดข้อผิดพลาด: ${err.message || err}` });
  }
});

if (isMainModule()) {
  app.listen(PORT, () => {
    console.log(`The Watcher API listening on ${PUBLIC_BASE_URL}`);
  });
}

export async function handleApiPayload(payload = {}) {
  return route(payload.action, payload);
}

async function route(action, p) {
  switch (action) {
    case 'ping': return { status: 'success', message: 'pong', time: now() };
    case 'branding': return apiBranding();
    case 'login': return apiLogin(p.username, p.password);
    case 'logout': return apiLogout(p.token);
    case 'me': return guard(p, ['view'], (user) => ({ status: 'success', user: publicUser(user) }));
    case 'getConfig': return guard(p, ['*'], apiGetConfig);
    case 'saveConfig': return guard(p, ['*'], () => apiSaveConfig(p.config));
    case 'uploadLogo': return guard(p, ['*'], () => apiUploadLogo(p.base64, p.filename));
    case 'removeLogo': return guard(p, ['*'], apiRemoveLogo);
    case 'getLocations': return guard(p, ['view'], apiGetLocations);
    case 'saveLocation': return guard(p, ['drug'], () => apiSaveLocation(p.location));
    case 'deleteLocation': return guard(p, ['drug'], () => apiDeleteLocation(p.id));
    case 'reorderLocations': return guard(p, ['drug'], () => apiReorderLocations(p.ids));
    case 'setDefaultReceive': return guard(p, ['drug'], () => apiSetDefaultReceive(p.id));
    case 'getDrugs': return guard(p, ['view'], apiGetDrugs);
    case 'saveDrug': return guard(p, ['drug'], () => apiSaveDrug(p.drug));
    case 'deleteDrug': return guard(p, ['drug'], () => apiDeleteDrug(p.id));
    case 'setRequireLot': return guard(p, ['drug'], () => apiSetRequireLot(p.id, p.value));
    case 'uploadImage': return guard(p, ['drug'], () => apiUploadImage(p.base64, p.filename));
    case 'receiveItem': return guard(p, ['receive'], (user) => apiReceiveItem(p, user));
    case 'recentReceives': return guard(p, ['view'], () => apiRecentTransactions('receive', p.limit || 20));
    case 'findDrugByCode': return guard(p, ['view'], () => apiFindDrugByCode(p.code));
    case 'getDashboard': return guard(p, ['view'], apiGetDashboard);
    case 'searchItems': return guard(p, ['view'], () => apiSearchItems(p.q));
    case 'getLocationStock': return guard(p, ['view'], apiGetLocationStock);
    case 'getLocationItems': return guard(p, ['view'], () => apiGetLocationItems(p.location_id));
    case 'exchangeItem': return guard(p, ['exchange'], (user) => apiExchangeItem(p, user));
    case 'recentExchanges': return guard(p, ['view'], () => apiRecentTransactions('exchange', p.limit || 20));
    case 'getNotifyConfig': return guard(p, ['*'], apiGetNotifyConfig);
    case 'saveNotifyConfig': return guard(p, ['*'], () => apiSaveNotifyConfig(p.notification));
    case 'testNotification': return guard(p, ['*'], apiTestNotification);
    case 'changePassword': return guard(p, ['view'], (user) => apiChangePassword(p, user));
    case 'exportData': return guard(p, ['view'], () => apiExportData(p));
    case 'disposeItem': return guard(p, ['receive'], (user) => apiDisposeItem(p, user));
    case 'getHistory': return guard(p, ['view'], () => apiGetHistory(p));
    case 'getUsers': return guard(p, ['*'], apiGetUsers);
    case 'saveUser': return guard(p, ['*'], () => apiSaveUser(p.user));
    case 'deleteUser': return guard(p, ['*'], (user) => apiDeleteUser(p.id, user));
    case 'getLowStock': return guard(p, ['view'], apiGetLowStock);
    case 'adjustItem': return guard(p, ['stock'], (user) => apiAdjustItem(p, user));
    default: return { status: 'error', message: `ไม่รู้จักคำสั่ง: ${action || ''}` };
  }
}

function isMainModule() {
  return process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
}


async function apiUploadLogo(base64, filename) {
  const saved = await saveUpload(base64, filename, 'logo');
  await pool.query('UPDATE app_config SET logo_file_id = $1 WHERE id = TRUE', [saved.id]);
  return { status: 'success', message: 'อัปโหลดโลโก้แล้ว', logo_url: fileUrl(saved.id) };
}

async function apiRemoveLogo() {
  await pool.query('UPDATE app_config SET logo_file_id = $1 WHERE id = TRUE', ['']);
  return { status: 'success', message: 'ลบโลโก้แล้ว' };
}

async function apiGetLocations() {
  const { rows } = await pool.query(
    `SELECT id, code_id, name, icon, color, is_default_receive, sort_order, active, created_at, updated_at
     FROM locations WHERE active ORDER BY sort_order, created_at`
  );
  return { status: 'success', data: rows.map(mapLocation) };
}

async function apiSaveLocation(loc = {}) {
  const name = String(loc.name || '').trim();
  if (!name) return { status: 'error', message: 'กรุณากรอกชื่อสถานที่' };
  if (loc.id) {
    const { rows } = await pool.query(
      `UPDATE locations SET name = $2, icon = COALESCE($3, icon), color = COALESCE($4, color)
       WHERE code_id = $1 AND active RETURNING *`,
      [loc.id, name, loc.icon ?? null, loc.color ?? null]
    );
    if (!rows[0]) return { status: 'error', message: 'ไม่พบสถานที่' };
    return { status: 'success', message: 'บันทึกแล้ว', location: mapLocation(rows[0]) };
  }
  const { rows } = await pool.query('SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM locations');
  const inserted = await pool.query(
    `INSERT INTO locations (name, icon, color, sort_order)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [name, loc.icon || 'box', loc.color || '#16A34A', rows[0].next_order]
  );
  return { status: 'success', message: 'เพิ่มสถานที่แล้ว', location: mapLocation(inserted.rows[0]) };
}

async function apiDeleteLocation(id) {
  const current = await pool.query('SELECT id FROM locations WHERE code_id = $1 AND active', [id]);
  if (!current.rows[0]) return { status: 'error', message: 'ไม่พบสถานที่' };
  const { rowCount } = await pool.query('UPDATE locations SET active = FALSE WHERE id = $1', [current.rows[0].id]);
  if (!rowCount) return { status: 'error', message: 'ไม่พบสถานที่' };
  await pool.query('UPDATE app_config SET default_receive_location_id = NULL WHERE default_receive_location_id = $1', [current.rows[0].id]);
  return { status: 'success', message: 'ลบสถานที่แล้ว' };
}

async function apiReorderLocations(ids = []) {
  if (!Array.isArray(ids) || !ids.length) return { status: 'error', message: 'ไม่มีข้อมูลลำดับ' };
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (let i = 0; i < ids.length; i += 1) {
      await client.query('UPDATE locations SET sort_order = $2 WHERE code_id = $1', [ids[i], i + 1]);
    }
    await client.query('COMMIT');
    return { status: 'success', message: 'จัดลำดับแล้ว' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function apiSetDefaultReceive(id) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE locations SET is_default_receive = FALSE WHERE active AND is_default_receive');
    const { rowCount } = await client.query(
      'UPDATE locations SET is_default_receive = TRUE WHERE code_id = $1 AND active',
      [id]
    );
    if (!rowCount) {
      await client.query('ROLLBACK');
      return { status: 'error', message: 'ไม่พบสถานที่' };
    }
    await client.query(
      'UPDATE app_config SET default_receive_location_id = (SELECT locations.id FROM locations WHERE locations.code_id = $1) WHERE id = TRUE',
      [id]
    );
    await client.query('COMMIT');
    return { status: 'success', message: 'ตั้งจุดเริ่มต้นรับเข้าแล้ว' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function apiGetDrugs() {
  const { rows } = await pool.query(
    `SELECT d.id, d.code_id, d.name, d.code, d.unit, d.require_lot, d.default_location_id,
            dl.code_id AS default_location_code_id, d.image_file_id, d.min_qty, d.active, d.created_at, d.updated_at
     FROM drugs d
     LEFT JOIN locations dl ON dl.id = d.default_location_id
     WHERE d.active
     ORDER BY d.name`
  );
  return { status: 'success', data: rows.map(mapDrug) };
}

async function apiUploadImage(base64, filename) {
  const saved = await saveUpload(base64, filename, 'drug');
  return { status: 'success', file_id: saved.id, url: fileUrl(saved.id) };
}

async function apiSaveDrug(d = {}) {
  const name = String(d.name || '').trim();
  if (!name) return { status: 'error', message: 'กรุณากรอกชื่อยา' };
  const code = String(d.code || '').trim();
  if (code) {
    const duplicate = await pool.query(
      'SELECT name FROM drugs WHERE active AND code = $1 AND ($2::text IS NULL OR code_id <> $2)',
      [code, d.id || null]
    );
    if (duplicate.rows[0]) return { status: 'error', message: `บาร์โค้ดนี้มีอยู่แล้ว: ${duplicate.rows[0].name}` };
  }
  const defaultLocation = await resolveCodeId('locations', d.default_location_id);
  if (d.id) {
    const current = await pool.query('SELECT * FROM drugs WHERE code_id = $1 AND active', [d.id]);
    if (!current.rows[0]) return { status: 'error', message: 'ไม่พบรายการยา' };
    const imageFileId = d.clear_image ? '' : (d.image_file_id || current.rows[0].image_file_id || '');
    const { rows } = await pool.query(
      `UPDATE drugs
       SET name = $2, code = $3, unit = $4, require_lot = $5, default_location_id = $6,
           image_file_id = $7, min_qty = $8
       WHERE code_id = $1 RETURNING *`,
      [d.id, name, code, String(d.unit || '').trim(), !!d.require_lot, defaultLocation, imageFileId, Number(d.min_qty) || 0]
    );
    return { status: 'success', message: 'บันทึกแล้ว', drug: mapDrug(rows[0]) };
  }
  const { rows } = await pool.query(
    `INSERT INTO drugs (name, code, unit, require_lot, default_location_id, image_file_id, min_qty)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [name, code, String(d.unit || '').trim(), !!d.require_lot, defaultLocation, d.image_file_id || '', Number(d.min_qty) || 0]
  );
  return { status: 'success', message: 'เพิ่มยาแล้ว', drug: mapDrug(rows[0]) };
}

async function apiDeleteDrug(id) {
  const { rowCount } = await pool.query('UPDATE drugs SET active = FALSE WHERE code_id = $1', [id]);
  if (!rowCount) return { status: 'error', message: 'ไม่พบรายการยา' };
  return { status: 'success', message: 'ลบรายการยาแล้ว' };
}

async function apiSetRequireLot(id, value) {
  const { rowCount } = await pool.query('UPDATE drugs SET require_lot = $2 WHERE code_id = $1', [id, !!value]);
  if (!rowCount) return { status: 'error', message: 'ไม่พบรายการยา' };
  return { status: 'success', message: 'อัปเดตแล้ว' };
}

async function apiFindDrugByCode(code) {
  const { rows } = await pool.query(
    `SELECT d.*, dl.code_id AS default_location_code_id
     FROM drugs d
     LEFT JOIN locations dl ON dl.id = d.default_location_id
     WHERE d.active AND d.code = $1
     LIMIT 1`,
    [String(code || '').trim()]
  );
  return { status: 'success', drug: rows[0] ? mapDrug(rows[0]) : null };
}

async function apiReceiveItem(p, user) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const drug = (await client.query('SELECT * FROM drugs WHERE code_id = $1 AND active FOR SHARE', [p.drug_id])).rows[0];
    if (!drug) return rollbackResult(client, { status: 'error', message: 'ไม่พบรายการยา' });
    const loc = (await client.query('SELECT * FROM locations WHERE code_id = $1 AND active FOR SHARE', [p.location_id])).rows[0];
    if (!loc) return rollbackResult(client, { status: 'error', message: 'ไม่พบสถานที่เก็บ' });
    const qty = Number(p.qty);
    if (!qty || qty <= 0) return rollbackResult(client, { status: 'error', message: 'จำนวนต้องมากกว่า 0' });
    const expiry = String(p.expiry_date || '').trim();
    if (!expiry) return rollbackResult(client, { status: 'error', message: 'กรุณาระบุวันหมดอายุ' });
    const lot = String(p.lot_no || '').trim();
    if (drug.require_lot && !lot) return rollbackResult(client, { status: 'error', message: 'ยานี้ต้องระบุ Lot No.' });

    const existing = await client.query(
      `SELECT * FROM items
       WHERE status = 'active' AND drug_id = $1 AND location_id = $2 AND lot_no = $3 AND expiry_date = $4
       FOR UPDATE`,
      [drug.id, loc.id, lot, expiry]
    );
    let item;
    let merged = false;
    if (existing.rows[0]) {
      const updated = await client.query('UPDATE items SET qty = qty + $2 WHERE id = $1 RETURNING *', [existing.rows[0].id, qty]);
      item = updated.rows[0];
      merged = true;
    } else {
      item = (await client.query(
        `INSERT INTO items (drug_id, location_id, lot_no, expiry_date, qty, received_by, note)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [drug.id, loc.id, lot, expiry, qty, user.username, String(p.note || '').trim()]
      )).rows[0];
    }
    await client.query(
      `INSERT INTO transactions (type, item_id, drug_id, to_location_id, qty, lot_no, expiry_date, by_username)
       VALUES ('receive', $1, $2, $3, $4, $5, $6, $7)`,
      [item.id, drug.id, loc.id, qty, lot, expiry, user.username]
    );
    await client.query('COMMIT');
    return { status: 'success', message: merged ? 'รับเข้าแล้ว (รวมกับ Lot เดิม)' : 'รับเข้าแล้ว', item: await mapItemWithNames(item), merged };
  } catch (err) {
    await client.query('ROLLBACK');
    await logError('receiveItem', err);
    return { status: 'error', message: 'บันทึกไม่สำเร็จ ลองอีกครั้ง' };
  } finally {
    client.release();
  }
}

async function apiGetDashboard() {
  const c = await readConfig();
  const { rows } = await pool.query(itemSelectSql("i.status = 'active' AND i.qty > 0"));
  const summary = { within35: 0, within60: 0, within120: 0, over120: 0, expired: 0, total_items: 0, total_qty: 0 };
  const near = [];
  const byLocMap = new Map();
  for (const row of rows) {
    const days = daysTo(row.expiry_date);
    const qty = Number(row.qty || 0);
    summary.total_items += 1;
    summary.total_qty += qty;
    if (days < 0) summary.expired += 1;
    if (days <= c.expiry_critical_days) summary.within35 += 1;
    else if (days <= c.expiry_high_days) summary.within60 += 1;
    else if (days <= c.expiry_medium_days) summary.within120 += 1;
    else summary.over120 += 1;
    if (days <= c.expiry_medium_days) {
      const item = mapItem(row);
      near.push(item);
      const key = item.location_id || '_';
      const cur = byLocMap.get(key) || { location_id: item.location_id, location_name: item.location_name, count: 0, qty: 0 };
      cur.count += 1;
      cur.qty += qty;
      byLocMap.set(key, cur);
    }
  }
  near.sort((a, b) => a.days - b.days);
  const lowStock = await apiGetLowStock();
  return {
    status: 'success',
    summary,
    near: near.slice(0, 100),
    by_location: [...byLocMap.values()].sort((a, b) => b.count - a.count),
    thresholds: { critical: c.expiry_critical_days, high: c.expiry_high_days, medium: c.expiry_medium_days },
    low_stock: lowStock.data
  };
}

async function apiSearchItems(query) {
  const q = `%${String(query || '').trim().toLowerCase()}%`;
  if (q === '%%') return { status: 'success', data: [] };
  const { rows } = await pool.query(
    itemSelectSql("i.status = 'active' AND i.qty > 0 AND (LOWER(d.name) LIKE $1 OR LOWER(l.name) LIKE $1 OR LOWER(i.lot_no) LIKE $1)"),
    [q]
  );
  return { status: 'success', data: rows.map(mapItem).sort((a, b) => a.days - b.days).slice(0, 100) };
}

async function apiGetLocationStock() {
  const locs = await pool.query(
    `SELECT l.id, l.code_id, l.name, l.icon, l.color,
            COUNT(i.id)::int AS count,
            COALESCE(SUM(i.qty), 0)::int AS qty
     FROM locations l
     LEFT JOIN items i ON i.location_id = l.id AND i.status = 'active' AND i.qty > 0
     WHERE l.active
     GROUP BY l.id
     ORDER BY l.sort_order, l.created_at`
  );
  const all = await pool.query("SELECT COUNT(*)::int AS count, COALESCE(SUM(qty), 0)::int AS qty FROM items WHERE status = 'active' AND qty > 0");
  return { status: 'success', all: all.rows[0], locations: locs.rows.map((x) => ({ ...x, id: x.code_id })) };
}

async function apiGetLocationItems(locationId) {
  const params = [];
  let where = "i.status = 'active' AND i.qty > 0";
  if (locationId && locationId !== 'all') {
    params.push(locationId);
    where += ` AND l.code_id = $${params.length}`;
  }
  const { rows } = await pool.query(itemSelectSql(where), params);
  return { status: 'success', data: rows.map(mapItem).sort((a, b) => a.days - b.days) };
}

async function apiExchangeItem(p, user) {
  return moveStock(p, user, 'exchange');
}

async function apiDisposeItem(p, user) {
  return moveStock(p, user, 'dispose');
}

async function apiAdjustItem(p, user) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const item = (await client.query('SELECT * FROM items WHERE code_id = $1 AND status = $2 FOR UPDATE', [p.item_id, 'active'])).rows[0];
    if (!item) return rollbackResult(client, { status: 'error', message: 'ไม่พบรายการยา' });
    const actual = Number(p.actual_qty);
    if (Number.isNaN(actual) || actual < 0) return rollbackResult(client, { status: 'error', message: 'จำนวนไม่ถูกต้อง' });
    const before = Number(item.qty || 0);
    if (actual === before) return rollbackResult(client, { status: 'success', message: 'ไม่มีการเปลี่ยนแปลง', unchanged: true });
    const tx = await client.query(
      `INSERT INTO transactions (type, item_id, drug_id, from_location_id, qty, lot_no, expiry_date, reason, note, by_username)
       VALUES ('adjust', $1, $2, $3, $4, $5, $6, 'ตรวจนับ', $7, $8)
       RETURNING id`,
      [item.id, item.drug_id, item.location_id, actual, item.lot_no, item.expiry_date, `ปรับจาก ${before} เป็น ${actual}${p.note ? ` · ${p.note}` : ''}`, user.username]
    );
    await client.query(
      `UPDATE items
       SET qty = $2, status = $3, closed_at = CASE WHEN $2 <= 0 THEN now() ELSE NULL END,
           closed_reason = CASE WHEN $2 <= 0 THEN 'ตรวจนับ' ELSE '' END,
           last_transaction_id = $4
       WHERE id = $1`,
      [item.id, actual, actual <= 0 ? 'disposed' : 'active', tx.rows[0].id]
    );
    await client.query('COMMIT');
    const named = await mapItemWithNames(item);
    return { status: 'success', message: `ปรับยอด ${named.drug_name} เป็น ${actual}` };
  } catch (err) {
    await client.query('ROLLBACK');
    await logError('adjustItem', err);
    return { status: 'error', message: 'ปรับยอดไม่สำเร็จ' };
  } finally {
    client.release();
  }
}

async function moveStock(p, user, type) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const item = (await client.query('SELECT * FROM items WHERE code_id = $1 AND status = $2 FOR UPDATE', [p.item_id, 'active'])).rows[0];
    if (!item) return rollbackResult(client, { status: 'error', message: 'ไม่พบรายการยา หรือถูกย้ายไปแล้ว' });
    const qty = Number(p.qty);
    if (!qty || qty <= 0) return rollbackResult(client, { status: 'error', message: 'จำนวนต้องมากกว่า 0' });
    if (qty > Number(item.qty || 0)) return rollbackResult(client, { status: 'error', message: `จำนวนเกินกว่าที่มี (${item.qty})` });
    const named = await mapItemWithNames(item, client);
    let dest = null;
    if (type === 'exchange') {
      dest = (await client.query('SELECT * FROM locations WHERE code_id = $1 AND active', [p.to_location_id])).rows[0];
      if (!dest) return rollbackResult(client, { status: 'error', message: 'ไม่พบสถานที่ปลายทาง' });
      if (String(dest.id) === String(item.location_id)) return rollbackResult(client, { status: 'error', message: 'ปลายทางต้องไม่ใช่สถานที่เดิม' });
    }
    const nextQty = Number(item.qty || 0) - qty;
    const nextStatus = nextQty <= 0 ? (type === 'exchange' ? 'exchanged' : (p.reason === 'เบิกใช้' ? 'used' : 'disposed')) : 'active';
    const closeReason = nextQty <= 0 ? (type === 'exchange' ? 'ย้ายออกหมด' : (String(p.reason || '').trim() || 'อื่นๆ')) : '';
    await client.query(
      `UPDATE items
       SET qty = $2, status = $3,
           closed_at = CASE WHEN $2 <= 0 THEN now() ELSE NULL END,
           closed_reason = $4
       WHERE id = $1`,
      [item.id, Math.max(nextQty, 0), nextStatus, closeReason]
    );
    if (type === 'exchange') {
      const existing = (await client.query(
        `SELECT * FROM items
         WHERE status = 'active' AND drug_id = $1 AND location_id = $2 AND lot_no = $3 AND expiry_date = $4
         FOR UPDATE`,
        [item.drug_id, dest.id, item.lot_no, item.expiry_date]
      )).rows[0];
      let destItemId = existing?.id;
      if (existing) {
        await client.query('UPDATE items SET qty = qty + $2 WHERE id = $1', [existing.id, qty]);
      } else {
        const inserted = await client.query(
          `INSERT INTO items (drug_id, location_id, lot_no, expiry_date, qty, received_by, note)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
          [item.drug_id, dest.id, item.lot_no, item.expiry_date, qty, user.username, `รับโอนจาก ${named.location_name}`]
        );
        destItemId = inserted.rows[0].id;
      }
      const tx = await client.query(
        `INSERT INTO transactions (type, item_id, drug_id, from_location_id, to_location_id, qty, lot_no, expiry_date, by_username)
         VALUES ('exchange', $1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [destItemId || item.id, item.drug_id, item.location_id, dest.id, qty, item.lot_no, item.expiry_date, user.username]
      );
      await client.query('UPDATE items SET last_transaction_id = $2 WHERE id IN ($1, $3)', [item.id, tx.rows[0].id, destItemId || item.id]);
      await client.query('COMMIT');
      return { status: 'success', message: `ย้าย ${named.drug_name} ${qty} ไป ${dest.name} แล้ว` };
    }
    const reason = String(p.reason || '').trim() || 'อื่นๆ';
    const tx = await client.query(
      `INSERT INTO transactions (type, item_id, drug_id, from_location_id, qty, lot_no, expiry_date, reason, note, by_username)
       VALUES ('dispose', $1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [item.id, item.drug_id, item.location_id, qty, item.lot_no, item.expiry_date, reason, String(p.note || '').trim(), user.username]
    );
    await client.query('UPDATE items SET last_transaction_id = $2 WHERE id = $1', [item.id, tx.rows[0].id]);
    await client.query('COMMIT');
    return { status: 'success', message: `ตัดจ่าย ${named.drug_name} ${qty} (${reason})` };
  } catch (err) {
    await client.query('ROLLBACK');
    await logError(type, err);
    return { status: 'error', message: type === 'exchange' ? 'ย้ายไม่สำเร็จ ลองอีกครั้ง' : 'ตัดจ่ายไม่สำเร็จ' };
  } finally {
    client.release();
  }
}

async function apiRecentTransactions(type, limit) {
  const { rows } = await pool.query(transactionSelectSql('t.type = $1', Number(limit) || 20), [type]);
  return { status: 'success', data: rows.map(mapTransaction) };
}

async function apiGetHistory(p) {
  const params = [];
  let where = 'TRUE';
  if (p.type) {
    params.push(String(p.type));
    where = `t.type = $${params.length}`;
  }
  const { rows } = await pool.query(transactionSelectSql(where, Number(p.limit) || 60), params);
  return { status: 'success', data: rows.map(mapTransaction) };
}

async function apiGetNotifyConfig() {
  const c = await readConfig();
  return { status: 'success', notification: configOut(c, false).notification };
}

async function apiSaveNotifyConfig(patch = {}) {
  await pool.query(
    `UPDATE app_config
     SET notification_enabled = COALESCE($1, notification_enabled),
         notification_channel = COALESCE($2, notification_channel),
         notify_time = COALESCE($3, notify_time),
         telegram_chat_id = COALESCE($4, telegram_chat_id),
         telegram_bot_token = CASE WHEN $5::text <> '' THEN $5 WHEN $6 THEN '' ELSE telegram_bot_token END,
         line_token = CASE WHEN $7::text <> '' THEN $7 WHEN $8 THEN '' ELSE line_token END
     WHERE id = TRUE`,
    [
      patch.enabled === undefined ? null : !!patch.enabled,
      patch.channel || null,
      patch.notify_time || null,
      patch.telegram_chat_id ?? null,
      patch.telegram_bot_token || '',
      !!patch.clear_telegram_token,
      patch.line_token || '',
      !!patch.clear_line_token
    ]
  );
  return { status: 'success', message: 'บันทึกการแจ้งเตือนแล้ว' };
}

function notificationLines(title, rows = []) {
  return rows.filter(Boolean).map((row) => `- ${row}`).join('\n');
}

function buildNotificationMessage({ hospitalName, near = [], low = [], test = false }) {
  const header = `${hospitalName || 'The Watcher'}${test ? ' - ข้อความทดสอบ' : ' - สรุปแจ้งเตือนยา'}`;
  const lines = [header];

  if (test) {
    lines.push('ระบบส่งข้อความเชื่อมต่อสำเร็จ');
  }

  if (near.length) {
    lines.push(`ใกล้หมดอายุ ${near.length} รายการ`);
    lines.push(
      notificationLines(
        'near',
        near.slice(0, 8).map((item) => {
          const days = item.days < 0 ? 'หมดอายุแล้ว' : `เหลือ ${item.days} วัน`;
          const lot = item.lot_no ? ` Lot ${item.lot_no}` : '';
          return `${item.drug_name}${lot} @ ${item.location_name || '-'} (${days})`;
        })
      )
    );
  } else if (!test) {
    lines.push('วันนี้ไม่มียาใกล้หมดอายุ');
  }

  if (low.length) {
    lines.push(`สต็อกต่ำ ${low.length} รายการ`);
    lines.push(
      notificationLines(
        'low',
        low.slice(0, 5).map((item) => `${item.name} คงเหลือ ${item.total} / ขั้นต่ำ ${item.min_qty || 0}`)
      )
    );
  }

  return lines.filter(Boolean).join('\n');
}

async function sendTelegramMessage(botToken, chatId, text) {
  if (!botToken || !chatId) {
    return { status: 'error', message: 'ตั้งค่า Telegram bot token และ chat id ให้ครบก่อน' };
  }

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) {
    return { status: 'error', message: payload.description || 'ส่ง Telegram ไม่สำเร็จ' };
  }
  return { status: 'success' };
}

async function sendLineBroadcast(lineToken, text) {
  if (!lineToken) {
    return { status: 'error', message: 'ตั้งค่า LINE channel access token ก่อน' };
  }

  const response = await fetch('https://api.line.me/v2/bot/message/broadcast', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${lineToken}`
    },
    body: JSON.stringify({
      messages: [{ type: 'text', text: text.slice(0, 5000) }]
    })
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    return { status: 'error', message: payload.message || 'ส่ง LINE ไม่สำเร็จ' };
  }
  return { status: 'success' };
}

export async function runNotificationDispatch(options = {}) {
  const config = configOut(await readConfig(), true);
  const notification = config.notification || {};

  if (!options.force && !notification.enabled) {
    return { status: 'success', skipped: true, message: 'ปิดการแจ้งเตือนอยู่' };
  }

  const dashboard = await apiGetDashboard();
  if (dashboard.status !== 'success') {
    return dashboard;
  }

  const text = options.text || buildNotificationMessage({
    hospitalName: config.hospital_name,
    near: dashboard.near || [],
    low: dashboard.low_stock || [],
    test: !!options.test
  });

  const result = notification.channel === 'line'
    ? await sendLineBroadcast(notification.line_token, text)
    : await sendTelegramMessage(notification.telegram_bot_token, notification.telegram_chat_id, text);

  if (result.status !== 'success') {
    return result;
  }

  return {
    status: 'success',
    message: options.test ? 'ส่งข้อความทดสอบแล้ว' : 'ส่งการแจ้งเตือนแล้ว',
    text
  };
}

async function apiTestNotification() {
  return runNotificationDispatch({ force: true, test: true });
}

async function apiChangePassword(p, user) {
  if (String(p.new_password || '').length < 4) return { status: 'error', message: 'รหัสผ่านใหม่ต้องอย่างน้อย 4 ตัวอักษร' };
  const { rowCount } = await pool.query(
    `UPDATE app_users
     SET password_hash = crypt($3, gen_salt('bf'))
     WHERE username = $1 AND password_hash = crypt($2, password_hash)`,
    [user.username, String(p.old_password || ''), String(p.new_password)]
  );
  if (!rowCount) return { status: 'error', message: 'รหัสผ่านเดิมไม่ถูกต้อง' };
  return { status: 'success', message: 'เปลี่ยนรหัสผ่านแล้ว' };
}

async function apiExportData(p) {
  const kind = p.kind || 'receive';
  const from = String(p.from || '');
  const to = String(p.to || '');
  if (kind === 'stock') {
    const { rows } = await pool.query(itemSelectSql("i.status = 'active' AND i.qty > 0"));
    return {
      status: 'success',
      columns: ['ยา', 'สถานที่', 'Lot No.', 'วันหมดอายุ', 'คงเหลือ(วัน)', 'จำนวน', 'รับเข้าโดย', 'รับเข้าเมื่อ'],
      rows: rows.map((it) => [it.drug_name, it.location_name, it.lot_no || '', dateOnly(it.expiry_date), daysTo(it.expiry_date), Number(it.qty || 0), it.received_by || '', dateOnly(it.received_at)]),
      filename: exportName(kind, from, to),
      count: rows.length
    };
  }
  const types = kind === 'receive' ? ['receive'] : ['receive', 'exchange', 'dispose', 'adjust'];
  const params = [types];
  let where = 't.type = ANY($1)';
  if (from) { params.push(from); where += ` AND t.created_at >= $${params.length}::date`; }
  if (to) { params.push(to); where += ` AND t.created_at < ($${params.length}::date + INTERVAL '1 day')`; }
  const { rows } = await pool.query(transactionSelectSql(where, 100000, 'ASC'), params);
  const columns = kind === 'receive'
    ? ['วันที่', 'เวลา', 'ยา', 'สถานที่', 'Lot No.', 'วันหมดอายุ', 'จำนวน', 'โดย']
    : ['วันที่', 'เวลา', 'ประเภท', 'ยา', 'จาก', 'ไป', 'Lot No.', 'วันหมดอายุ', 'จำนวน', 'เหตุผล', 'โดย'];
  const dataRows = rows.map(mapTransaction).map((t) => {
    const d = new Date(t.created_at);
    const date = d.toLocaleDateString('th-TH');
    const time = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    if (kind === 'receive') return [date, time, t.drug_name, t.to_location_name || '', t.lot_no || '', t.expiry_date || '', Number(t.qty || 0), t.by || ''];
    const label = t.type === 'receive' ? 'รับเข้า' : (t.type === 'exchange' ? 'ย้าย/แลก' : (t.type === 'dispose' ? 'ตัดจ่าย/ทิ้ง' : 'ปรับยอด'));
    return [date, time, label, t.drug_name, t.from_location_name || '', t.to_location_name || '', t.lot_no || '', t.expiry_date || '', Number(t.qty || 0), t.reason || '', t.by || ''];
  });
  return { status: 'success', columns, rows: dataRows, filename: exportName(kind, from, to), count: dataRows.length };
}

async function apiGetUsers() {
  const { rows } = await pool.query('SELECT id, code_id, username, name, role, active, last_login FROM app_users ORDER BY created_at');
  return { status: 'success', data: rows.map((u) => ({ ...u, id: u.code_id, last_login: toIso(u.last_login) || '' })) };
}

async function apiSaveUser(u = {}) {
  const username = String(u.username || '').trim();
  if (!username) return { status: 'error', message: 'กรุณากรอกชื่อผู้ใช้' };
  const role = ROLES[u.role] ? u.role : 'staff';
  const name = String(u.name || '').trim() || ROLES[role].name;
  if (u.id) {
    const duplicate = await pool.query('SELECT id FROM app_users WHERE username = $1 AND code_id <> $2', [username, u.id]);
    if (duplicate.rows[0]) return { status: 'error', message: 'ชื่อผู้ใช้นี้มีอยู่แล้ว' };
    const passwordSql = u.password && String(u.password).length >= 4 ? ', password_hash = crypt($7, gen_salt(\'bf\'))' : '';
    const params = [u.id, username, name, role, ROLES[role].permissions, u.active !== undefined ? !!u.active : true];
    if (passwordSql) params.push(String(u.password));
    const { rowCount } = await pool.query(
      `UPDATE app_users SET username = $2, name = $3, role = $4, permissions = $5, active = $6 ${passwordSql} WHERE code_id = $1`,
      params
    );
    if (!rowCount) return { status: 'error', message: 'ไม่พบผู้ใช้' };
    return { status: 'success', message: 'บันทึกผู้ใช้แล้ว' };
  }
  if (!u.password || String(u.password).length < 4) return { status: 'error', message: 'ตั้งรหัสผ่านอย่างน้อย 4 ตัวอักษร' };
  try {
    await pool.query(
      `INSERT INTO app_users (username, password_hash, role, name, permissions)
       VALUES ($1, crypt($2, gen_salt('bf')), $3, $4, $5)`,
      [username, String(u.password), role, name, ROLES[role].permissions]
    );
    return { status: 'success', message: 'เพิ่มผู้ใช้แล้ว' };
  } catch (err) {
    if (err.code === '23505') return { status: 'error', message: 'ชื่อผู้ใช้นี้มีอยู่แล้ว' };
    throw err;
  }
}

async function apiDeleteUser(id, actor) {
  const current = await pool.query('SELECT username FROM app_users WHERE code_id = $1', [id]);
  if (!current.rows[0]) return { status: 'error', message: 'ไม่พบผู้ใช้' };
  if (current.rows[0].username === actor.username) return { status: 'error', message: 'ลบบัญชีตัวเองไม่ได้' };
  await pool.query('DELETE FROM app_users WHERE code_id = $1', [id]);
  return { status: 'success', message: 'ลบผู้ใช้แล้ว' };
}

async function apiGetLowStock() {
  const { rows } = await pool.query(
    `SELECT d.id AS drug_id, d.code_id AS drug_code_id, d.name, d.unit, d.min_qty,
            COALESCE(SUM(i.qty) FILTER (WHERE i.status = 'active'), 0)::int AS total,
            d.image_file_id
     FROM drugs d
     LEFT JOIN items i ON i.drug_id = d.id
     WHERE d.active AND d.min_qty > 0
     GROUP BY d.id
     HAVING COALESCE(SUM(i.qty) FILTER (WHERE i.status = 'active'), 0) < d.min_qty
     ORDER BY (COALESCE(SUM(i.qty) FILTER (WHERE i.status = 'active'), 0) - d.min_qty)`
  );
  return {
    status: 'success',
    data: rows.map((d) => ({
      drug_id: d.drug_code_id,
      name: d.name,
      unit: d.unit || '',
      min_qty: Number(d.min_qty),
      total: Number(d.total),
      image_url: d.image_file_id ? fileUrl(d.image_file_id) : ''
    }))
  };
}

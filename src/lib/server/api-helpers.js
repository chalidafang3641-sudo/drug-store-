import fs from 'node:fs/promises';
import path from 'node:path';
import { pool } from './postgres.js';
import { PUBLIC_BASE_URL, supabaseAdmin, uploadDir } from './api-runtime.js';

export function itemSelectSql(where) {
  return `SELECT i.*, d.code_id AS drug_code_id, d.name AS drug_name, d.image_file_id,
                 l.code_id AS location_code_id, l.name AS location_name,
                 lt.code_id AS last_transaction_code_id
          FROM items i
          JOIN drugs d ON d.id = i.drug_id
          JOIN locations l ON l.id = i.location_id
          LEFT JOIN transactions lt ON lt.id = i.last_transaction_id
          WHERE ${where}`;
}

export function transactionSelectSql(where, limit, direction = 'DESC') {
  return `SELECT t.*, i.code_id AS item_code_id, d.code_id AS drug_code_id, d.name AS drug_name,
                 fl.code_id AS from_location_code_id, fl.name AS from_location_name,
                 tl.code_id AS to_location_code_id, tl.name AS to_location_name
          FROM transactions t
          LEFT JOIN items i ON i.id = t.item_id
          LEFT JOIN drugs d ON d.id = t.drug_id
          LEFT JOIN locations fl ON fl.id = t.from_location_id
          LEFT JOIN locations tl ON tl.id = t.to_location_id
          WHERE ${where}
          ORDER BY t.created_at ${direction}
          LIMIT ${Number(limit) || 60}`;
}

export function mapLocation(l) {
  return {
    id: l.code_id,
    name: l.name,
    icon: l.icon,
    color: l.color,
    is_default_receive: !!l.is_default_receive,
    sort_order: Number(l.sort_order || 0),
    active: l.active !== false,
    created_at: toIso(l.created_at),
    updated_at: toIso(l.updated_at)
  };
}

export function mapDrug(d) {
  return {
    id: d.code_id,
    name: d.name,
    code: d.code || '',
    unit: d.unit || '',
    require_lot: !!d.require_lot,
    default_location_id: d.default_location_code_id || '',
    image_file_id: d.image_file_id || '',
    image_url: d.image_file_id ? fileUrl(d.image_file_id) : '',
    min_qty: Number(d.min_qty || 0),
    active: d.active !== false,
    created_at: toIso(d.created_at),
    updated_at: toIso(d.updated_at)
  };
}

export function mapItem(it) {
  return {
    id: it.code_id,
    drug_id: it.drug_code_id || '',
    drug_name: it.drug_name,
    image_url: it.image_file_id ? fileUrl(it.image_file_id) : '',
    location_id: it.location_code_id || '',
    location_name: it.location_name,
    lot_no: it.lot_no || '',
    expiry_date: dateOnly(it.expiry_date),
    qty: Number(it.qty || 0),
    days: daysTo(it.expiry_date),
    status: it.status,
    closed_at: toIso(it.closed_at),
    closed_reason: it.closed_reason || '',
    last_transaction_id: it.last_transaction_code_id || '',
    received_by: it.received_by || '',
    received_at: toIso(it.received_at),
    note: it.note || '',
    created_at: toIso(it.created_at),
    updated_at: toIso(it.updated_at)
  };
}

export async function mapItemWithNames(it, client = pool) {
  const { rows } = await client.query(itemSelectSql('i.id = $1'), [it.id]);
  return rows[0] ? mapItem(rows[0]) : mapItem({ ...it, drug_name: '', location_name: '' });
}

export function mapTransaction(t) {
  return {
    id: t.code_id,
    type: t.type,
    item_id: t.item_code_id || '',
    drug_id: t.drug_code_id || '',
    drug_name: t.drug_name || '',
    from_location_id: t.from_location_code_id || '',
    from_location_name: t.from_location_name || '',
    to_location_id: t.to_location_code_id || '',
    to_location_name: t.to_location_name || '',
    qty: Number(t.qty || 0),
    lot_no: t.lot_no || '',
    expiry_date: dateOnly(t.expiry_date),
    reason: t.reason || '',
    note: t.note || '',
    by: t.by_username || '',
    created_at: toIso(t.created_at)
  };
}

export async function resolveCodeId(table, codeId, client = pool) {
  if (!codeId) return null;
  const allowed = new Set(['locations', 'drugs', 'items', 'app_users']);
  if (!allowed.has(table)) throw new Error(`Unsupported code_id table: ${table}`);
  const { rows } = await client.query(`SELECT id FROM ${table} WHERE code_id = $1`, [codeId]);
  return rows[0]?.id || null;
}

export async function saveUpload(base64, filename = '', prefix = 'file') {
  if (!base64) throw new Error('ไม่พบไฟล์รูป');
  const match = String(base64).match(/^data:(.+?);base64,(.+)$/);
  const body = match ? match[2] : String(base64);
  const mime = match?.[1] || '';
  const ext = extensionFor(filename, mime);
  const id = `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}${ext}`;
  const bytes = Buffer.from(body, 'base64');

  if (supabaseAdmin) {
    const bucket = prefix === 'logo' ? 'branding' : 'drug-images';
    const objectPath = `${prefix}/${id}`;
    const { error } = await supabaseAdmin.storage
      .from(bucket)
      .upload(objectPath, bytes, { contentType: mime || mimeForExt(ext), upsert: false });
    if (error) throw new Error(error.message);
    const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(objectPath);
    return { id: data.publicUrl };
  }

  await fs.mkdir(uploadDir, { recursive: true });
  await fs.writeFile(path.join(uploadDir, id), bytes);
  return { id };
}

export function fileUrl(id) {
  if (!id) return '';
  if (/^https?:\/\//.test(id)) return id;
  return `${PUBLIC_BASE_URL}/uploads/${encodeURIComponent(id)}`;
}

export function daysTo(value) {
  const exp = new Date(`${dateOnly(value)}T00:00:00Z`);
  const nowDate = new Date();
  const today = new Date(Date.UTC(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate()));
  return Math.round((exp.getTime() - today.getTime()) / 86400000);
}

export function dateOnly(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

export function toIso(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value.toISOString();
}

export function exportName(kind, from, to) {
  const nameMap = { receive: 'รับเข้า', stock: 'สต็อกคงเหลือ', all: 'การเคลื่อนไหว' };
  return `TheWatcher_${nameMap[kind] || kind}${from ? `_${from}` : ''}${to && to !== from ? `_ถึง_${to}` : ''}.xlsx`;
}

export function now() {
  return new Date().toISOString();
}

export async function logError(whereName, err) {
  try {
    await pool.query(
      'INSERT INTO errors (where_name, message, stack) VALUES ($1, $2, $3)',
      [whereName, String(err?.message || err), String(err?.stack || '')]
    );
  } catch {
    // Avoid recursive failures while reporting errors.
  }
}

export async function rollbackResult(client, result) {
  await client.query('ROLLBACK');
  return result;
}

function extensionFor(filename, mime) {
  const ext = path.extname(String(filename || '')).toLowerCase();
  if (['.png', '.jpg', '.jpeg', '.webp', '.svg'].includes(ext)) return ext;
  if (mime === 'image/jpeg') return '.jpg';
  if (mime === 'image/webp') return '.webp';
  if (mime === 'image/svg+xml') return '.svg';
  return '.png';
}

function mimeForExt(ext) {
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.svg') return 'image/svg+xml';
  return 'image/png';
}

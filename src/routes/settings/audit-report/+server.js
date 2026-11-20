import { error } from '@sveltejs/kit';
import { render } from 'svelte/server';
import { requirePermission } from '$lib/server/permissions.js';
import { pool, useD1 } from '$lib/server/postgres.js';
import Report from './Report.svelte';

const bangkok = { timeZone: 'Asia/Bangkok' };

export async function GET({ locals, url }) {
  requirePermission(locals, ['stock']);
  const locationId = url.searchParams.get('location_id');
  if (!locationId) error(400, 'กรุณาเลือกสถานที่');
  const { rows: [location] } = await pool.query('SELECT id, name FROM locations WHERE code_id = $1 AND active', [locationId]);
  if (!location) error(404, 'ไม่พบสถานที่');

  const now = new Date();
  const day = new Intl.DateTimeFormat('sv-SE', bangkok).format(now);
  const start = new Date(day + 'T00:00:00+07:00');
  const end = new Date(start.getTime() + 86400000);
  // Imported and D1-native timestamps use different text formats. Compare instants.
  const timestamp = useD1 ? 'julianday(t.created_at)' : 't.created_at';
  const lower = useD1 ? 'julianday($2)' : '$2';
  const upper = useD1 ? 'julianday($3)' : '$3';
  const [stock, adjustments] = await Promise.all([
    pool.query(`SELECT d.name, d.unit, i.lot_no, i.expiry_date, i.qty FROM items i
      JOIN drugs d ON d.id=i.drug_id WHERE i.location_id=$1 AND i.status='active' AND i.qty>0
      ORDER BY i.expiry_date, d.name, i.lot_no, i.id`, [location.id]),
    pool.query(`SELECT d.name, t.lot_no, t.qty, t.note, t.by_username FROM transactions t
      JOIN drugs d ON d.id=t.drug_id WHERE t.type='adjust' AND t.from_location_id=$1
      AND ${timestamp} >= ${lower} AND ${timestamp} < ${upper} ORDER BY ${timestamp}, t.id`, [location.id, start.toISOString(), end.toISOString()])
  ]);

  const { body } = render(Report, { props: { location: location.name, printed: now.toLocaleString('th-TH', bangkok), stock: stock.rows, adjustments: adjustments.rows } });
  return new Response('<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>รายงานตรวจนับสต็อกยา</title><style>@page{size:A4;margin:12mm}body{font:14px sans-serif;color:#19241e;margin:1rem}h1{font-size:1.5rem}h2{font-size:1.1rem}table{width:100%;border-collapse:collapse}td,th{border:1px solid #888;padding:5px;text-align:left}tr{break-inside:avoid}@media print{button{display:none}body{margin:0}}</style></head><body>' + body + '<script>document.getElementById("print-report").onclick=()=>window.print();window.addEventListener("load",()=>window.print())</script></body></html>', { headers: { 'content-type':'text/html; charset=utf-8', 'cache-control':'private, no-store' } });
}

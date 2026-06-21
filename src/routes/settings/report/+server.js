import { requirePermission } from '$lib/server/permissions.js';
import { handleApiPayload } from '../../../../server/index.js';

function esc(value) {
  return String(value == null ? '' : value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' });
}

function htmlDocument({ hospitalName, title, subtitle, columns, rows }) {
  const head = columns.map((column) => `<th>${esc(column)}</th>`).join('');
  const body = rows
    .map((row) => `<tr>${row.map((cell) => `<td>${esc(cell)}</td>`).join('')}</tr>`)
    .join('');

  return `<!doctype html>
<html lang="th">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${esc(title)}</title>
    <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600&display=swap" rel="stylesheet" />
    <style>
      @page { size: A4; margin: 14mm; }
      body { margin: 0; padding: 24px; font-family: "Sarabun", sans-serif; color: #19241e; }
      h1 { margin: 0 0 2px; font-size: 18px; }
      .sub { margin: 0 0 14px; color: #5a6b62; font-size: 12px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th, td { border: 1px solid #cfdcd4; padding: 6px 8px; text-align: left; vertical-align: top; }
      th { background: #e9f3ed; }
      tbody tr:nth-child(even) td { background: #f6faf8; }
    </style>
  </head>
  <body>
    <h1>${esc(hospitalName)}</h1>
    <div class="sub">${esc(title)} · ${esc(subtitle)}</div>
    <table>
      <thead>
        <tr>${head}</tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
    <script>
      window.onload = function () {
        setTimeout(function () { window.print(); }, 350);
      };
    </script>
  </body>
</html>`;
}

export async function GET({ locals, url }) {
  requirePermission(locals, ['view']);

  const kind = url.searchParams.get('kind') || 'near';
  const branding = await handleApiPayload({ action: 'branding' });
  const hospitalName = branding?.branding?.hospital_name || 'The Watcher';
  const printedAt = new Date().toLocaleString('th-TH');

  if (kind === 'stock') {
    const result = await handleApiPayload({ action: 'exportData', token: locals.token, kind: 'stock' });
    if (result.status !== 'success') {
      return new Response(result.message || 'Report failed', { status: 400 });
    }

    return new Response(
      htmlDocument({
        hospitalName,
        title: 'รายงานสต็อกคงเหลือ',
        subtitle: `พิมพ์เมื่อ ${printedAt} · รวม ${result.count || 0} รายการ`,
        columns: result.columns || [],
        rows: result.rows || []
      }),
      { headers: { 'content-type': 'text/html; charset=utf-8' } }
    );
  }

  const dashboard = await handleApiPayload({ action: 'getDashboard', token: locals.token });
  if (dashboard.status !== 'success') {
    return new Response(dashboard.message || 'Report failed', { status: 400 });
  }

  const rows = (dashboard.near || []).map((item) => [
    item.drug_name || '',
    item.location_name || '',
    item.lot_no || '',
    formatDate(item.expiry_date),
    item.days < 0 ? 'หมดอายุ' : item.days,
    item.qty || 0
  ]);

  return new Response(
    htmlDocument({
      hospitalName,
      title: 'รายงานยาใกล้หมดอายุ',
      subtitle: `พิมพ์เมื่อ ${printedAt} · รวม ${rows.length} รายการ`,
      columns: ['ยา', 'สถานที่', 'Lot', 'วันหมดอายุ', 'เหลือ (วัน)', 'จำนวน'],
      rows
    }),
    { headers: { 'content-type': 'text/html; charset=utf-8' } }
  );
}

import { expirySelection } from '$lib/server/expiry-selection.js';
import writeXlsxFile from 'write-excel-file/node';
import { requirePermission } from '$lib/server/permissions.js';
import { handleApiPayload } from '../../../../server/index.js';

import { pool } from '$lib/server/postgres.js';
import { itemSelectSql, mapItem } from '$lib/server/api-helpers.js';
import { expiryByLocation } from '$lib/server/notification-content.js';

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

function htmlDocument({ hospitalName, title, subtitle, columns, rows = [], groups, navigation = '' }) {
  const head = columns.map((column) => `<th>${esc(column)}</th>`).join('');
  const renderRows = rows => rows
    .map((row) => `<tr>${row.map((cell) => `<td>${esc(cell)}</td>`).join('')}</tr>`)
    .join('');
  const body = groups?.length ? groups.map(group =>
    `<tbody><tr class="location"><th colspan="${columns.length}" scope="rowgroup">${esc(group.name)} · ${group.rows.length} รายการ</th></tr>${renderRows(group.rows)}</tbody>`
  ).join('') : `<tbody>${renderRows(rows)}</tbody>`;

  return `<!doctype html>
<html lang="th">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${esc(title)}</title>
    <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600&display=swap" rel="stylesheet" />
    ${navigation ? '<link rel="stylesheet" href="/css/pagination.css">' : ''}
    <style>
      @page { size: A4; margin: 14mm; }
      body { margin: 0; padding: 24px; font-family: "Sarabun", sans-serif; color: #19241e; }
      h1 { margin: 0 0 2px; font-size: 18px; }
      .sub { margin: 0 0 14px; color: #5a6b62; font-size: 12px; }
      @media print { nav { display: none; } }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th, td { border: 1px solid #cfdcd4; padding: 6px 8px; text-align: left; vertical-align: top; }
      th { background: #e9f3ed; }
      .location { break-after: avoid; }
      tbody + tbody .location th { border-top: 3px solid #52665a; }
      tr { break-inside: avoid; }
      tbody tr:nth-child(even) td { background: #f6faf8; }
    </style>
  </head>
  <body>
    <h1>${esc(hospitalName)}</h1>
    <div class="sub">${esc(title)}${subtitle ? ` · ${esc(subtitle)}` : ''}</div>
    ${navigation}
    <table>
      <thead>
        <tr>${head}</tr>
      </thead>
      ${body}
    </table>
    ${navigation ? '' : `<script>
      window.onload = function () {
        setTimeout(function () { window.print(); }, 350);
      };
    </script>`}
  </body>
</html>`;
}

export async function GET({ locals, url }) {
  requirePermission(locals, ['view']);

  const kind = url.searchParams.get('kind') || 'near';
  const { rows: [config] } = await pool.query(
    'SELECT hospital_name, expiry_critical_days, expiry_high_days, expiry_medium_days FROM app_config WHERE id = TRUE'
  );
  const hospitalName = config.hospital_name || 'The Watcher';
  const printedAt = new Date().toLocaleString('th-TH');

  if (kind === 'stock') {
    const print = url.searchParams.get('print') === 'all';
    const options = print ? {} : { page: url.searchParams.get('page') || 1, size: url.searchParams.get('size') };
    const result = await handleApiPayload({ action: 'exportData', token: locals.token, kind: 'stock', ...options });
    if (result.status !== 'success') {
      return new Response(result.message || 'Report failed', { status: 400 });
    }

    let navigation = '';
    let subtitle = `พิมพ์เมื่อ ${printedAt} · รวม ${result.count} รายการ`;
    if (!print) {
      const { page, size, total, pages } = result.pagination;
      const start = total ? (page - 1) * size + 1 : 0;
      subtitle = `แสดง ${start}–${Math.min(page * size, total)} จาก ${total} รายการ`;
      const link = n => `?kind=stock&amp;page=${n}&amp;size=${size}`;
      navigation = `<nav class="pager" aria-label="หน้ารายงานสต็อก">
        <form method="get">
          <input type="hidden" name="kind" value="stock">
          <select name="size" aria-label="จำนวนรายการต่อหน้า" onchange="this.form.requestSubmit()">
            ${[10,25,50,100].map(n => `<option value="${n}"${n === size ? ' selected' : ''}>${n} / หน้า</option>`).join('')}
          </select><noscript><button>แสดง</button></noscript>
        </form>
        <div class="pager-position">
          <strong aria-label="${subtitle}">${start}–${Math.min(page * size, total)} / ${total}</strong>
        <div class="pager-steps">
          <a class="pager-arrow" aria-label="ก่อนหน้า" ${page > 1 ? `href="${link(page - 1)}"` : 'aria-disabled="true"'}>‹</a>
          <span aria-current="page">หน้า <b>${page}</b> จาก ${pages}</span>
          <a class="pager-arrow" aria-label="ถัดไป" ${page < pages ? `href="${link(page + 1)}"` : 'aria-disabled="true"'}>›</a>
        </div>
        </div>
        <a class="pager-print" href="?kind=stock&amp;print=all" target="_blank" rel="noreferrer">พิมพ์รายงานทุกหน้า</a>
      </nav>`;
    }

    return new Response(
      htmlDocument({
        hospitalName,
        title: 'รายงานสต็อกคงเหลือ',
        subtitle: navigation ? '' : subtitle, navigation,
        columns: result.columns || [],
        rows: result.rows || []
      }),
      { headers: { 'content-type': 'text/html; charset=utf-8' } }
    );
  }

  const { where, params } = expirySelection(url.searchParams.get('filter'), config);
  const { rows } = await pool.query(itemSelectSql(where), params);
  const locations = expiryByLocation(rows.map(mapItem));
  const columns = ['ลำดับ', 'ยา', 'Lot', 'วันหมดอายุ', 'เหลือ (วัน)', 'จำนวน'];
  if (url.searchParams.get('format') === 'xlsx') {
    const heading = value => ({ type: String, value, fontWeight: 'bold', backgroundColor: '#E9F3ED' });
    const sheet = [[heading(hospitalName)], [heading('รายงานยาใกล้หมดอายุ')], columns.map(heading)];
    for (const { name, items } of locations) {
      sheet.push([{ ...heading(name), span: columns.length }]);
      items.forEach((item, index) => sheet.push([
        { type: Number, value: index + 1 },
        { type: String, value: item.drug_name },
        { type: String, value: item.lot_no },
        { type: Date, value: new Date(item.expiry_date + 'T00:00:00Z'), format: 'dd/mm/yyyy' },
        item.days < 0 ? { type: String, value: 'หมดอายุ' } : { type: Number, value: item.days },
        { type: Number, value: item.qty }
      ]));
    }
    const buffer = await writeXlsxFile(sheet, {
      buffer: true, sheet: 'รายงานยาหมดอายุ',
      columns: [10, 46, 22, 18, 16, 14].map(width => ({ width }))
    });
    return new Response(new Uint8Array(buffer), { headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': 'attachment; filename="expiry-report.xlsx"',
      'cache-control': 'private, no-store'
    } });
  }
  const groups = locations.map(({ name, items }) => ({
    name,
    rows: items.map((item, index) => [index + 1,
      item.drug_name, item.lot_no, formatDate(item.expiry_date),
      item.days < 0 ? 'หมดอายุ' : item.days, item.qty
    ])
  }));

  return new Response(
    htmlDocument({
      hospitalName,
      title: 'รายงานยาใกล้หมดอายุ',
      subtitle: `พิมพ์เมื่อ ${printedAt} · รวม ${rows.length} รายการ`,
      columns,
      groups
    }),
    { headers: { 'content-type': 'text/html; charset=utf-8' } }
  );
}

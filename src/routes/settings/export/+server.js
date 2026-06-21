import { requirePermission } from '$lib/server/permissions.js';
import { handleApiPayload } from '../../../../server/index.js';

function csvCell(value) {
  const text = value == null ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function csvBody(columns = [], rows = []) {
  return [columns, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
}

export async function GET({ locals, url }) {
  requirePermission(locals, ['view']);

  const kind = url.searchParams.get('kind') || 'receive';
  const result = await handleApiPayload({
    action: 'exportData',
    token: locals.token,
    kind,
    from: kind === 'stock' ? '' : url.searchParams.get('from') || '',
    to: kind === 'stock' ? '' : url.searchParams.get('to') || ''
  });

  if (result.status !== 'success') {
    return new Response(result.message || 'Export failed', { status: 400 });
  }

  const filename = String(result.filename || 'drug-store-export.csv').replace(/\.xlsx$/i, '.csv');
  return new Response(`\uFEFF${csvBody(result.columns || [], result.rows || [])}`, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`
    }
  });
}

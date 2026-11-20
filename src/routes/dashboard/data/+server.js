import { requirePermission } from '$lib/server/permissions.js';
import { apiGetDashboard, handleApiPayload } from '../../../../server/index.js';

export async function GET({ locals, url, request }) {
  requirePermission(locals, ['view']);
  const query = url.searchParams;
  const selected = query.get('filter');
  const filter = ['crit', 'high', 'med'].includes(selected) ? selected : 'all';
  const q = (query.get('q') || '').trim();
  const dashboard = await apiGetDashboard({ filter, size: query.get('size'), page: query.get('page') || 1 },
    request.headers.get('x-dashboard-version'));
  const search = q ? await handleApiPayload({ action: 'searchItems', token: locals.token, q }) : null;
  return Response.json({ ...dashboard, filter, q, searchResults: search?.data || [] }, {
    headers: { 'cache-control': 'private, no-store' }
  });
}

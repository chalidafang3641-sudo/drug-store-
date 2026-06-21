import { redirect } from '@sveltejs/kit';
import { requirePermission } from '$lib/server/permissions.js';
import { handleApiPayload } from '../../../server/index.js';

export async function load({ locals, url }) {
  const user = requirePermission(locals, ['view']);
  const q = String(url.searchParams.get('q') || '').trim();

  const dashboard = await handleApiPayload({ action: 'getDashboard', token: locals.token });
  if (dashboard.status !== 'success') {
    redirect(303, '/login');
  }

  let searchResults = [];
  if (q) {
    const search = await handleApiPayload({ action: 'searchItems', token: locals.token, q });
    if (search.status === 'success') {
      searchResults = search.data || [];
    }
  }

  return {
    user,
    q,
    searchResults,
    summary: dashboard.summary,
    near: dashboard.near || [],
    lowStock: dashboard.low_stock || [],
    byLocation: dashboard.by_location || [],
    thresholds: dashboard.thresholds || {}
  };
}

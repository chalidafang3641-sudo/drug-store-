import { redirect } from '@sveltejs/kit';
import { handleApiPayload } from '../../../server/index.js';

export async function load({ locals }) {
  if (!locals.user) {
    redirect(303, '/login');
  }

  const dashboard = await handleApiPayload({ action: 'getDashboard', token: locals.token });
  if (dashboard.status !== 'success') {
    redirect(303, '/login');
  }

  return {
    user: locals.user,
    summary: dashboard.summary,
    near: dashboard.near || [],
    lowStock: dashboard.low_stock || [],
    byLocation: dashboard.by_location || [],
    thresholds: dashboard.thresholds || {}
  };
}

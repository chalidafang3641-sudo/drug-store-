import { fail, redirect } from '@sveltejs/kit';
import { handleApiPayload } from '../../../server/index.js';

export async function load({ locals, url }) {
  if (!locals.user) {
    redirect(303, '/login');
  }

  const q = String(url.searchParams.get('q') || '').trim();
  const [locations, recent, search] = await Promise.all([
    handleApiPayload({ action: 'getLocations', token: locals.token }),
    handleApiPayload({ action: 'recentExchanges', token: locals.token, limit: 15 }),
    q ? handleApiPayload({ action: 'searchItems', token: locals.token, q }) : Promise.resolve({ status: 'success', data: [] })
  ]);

  if (locations.status !== 'success') {
    redirect(303, '/login');
  }

  return {
    q,
    locations: locations.data || [],
    searchResults: search.status === 'success' ? search.data || [] : [],
    recent: recent.status === 'success' ? recent.data || [] : []
  };
}

export const actions = {
  default: async ({ request, locals }) => {
    if (!locals.user) {
      redirect(303, '/login');
    }

    const form = await request.formData();
    const payload = {
      action: 'exchangeItem',
      token: locals.token,
      item_id: String(form.get('item_id') || ''),
      to_location_id: String(form.get('to_location_id') || ''),
      qty: Number(form.get('qty') || 0)
    };
    const values = {
      item_id: payload.item_id,
      to_location_id: payload.to_location_id,
      qty: payload.qty || 1
    };

    if (!payload.item_id || !payload.to_location_id || payload.qty <= 0) {
      return fail(400, { message: 'กรุณาเลือกรายการยา สถานที่ปลายทาง และจำนวนให้ถูกต้อง', values });
    }

    const result = await handleApiPayload(payload);
    if (result.status !== 'success') {
      return fail(400, { message: result.message || 'ย้ายยาไม่สำเร็จ', values });
    }

    return { message: result.message || 'ย้ายยาแล้ว' };
  }
};

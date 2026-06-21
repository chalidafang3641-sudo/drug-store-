import { fail, redirect } from '@sveltejs/kit';
import { requirePermission } from '$lib/server/permissions.js';
import { handleApiPayload } from '../../../server/index.js';

export async function load({ locals, url }) {
  requirePermission(locals, ['view']);

  const selectedLocationId = String(url.searchParams.get('location_id') || '').trim();
  const stock = await handleApiPayload({ action: 'getLocationStock', token: locals.token });
  const items = selectedLocationId
    ? await handleApiPayload({
        action: 'getLocationItems',
        token: locals.token,
        location_id: selectedLocationId
      })
    : { status: 'success', data: [] };

  if (stock.status !== 'success' || items.status !== 'success') {
    redirect(303, '/login');
  }

  const locations = [
    { id: 'all', name: 'รวมทุกสถานที่', color: '#16A34A', count: stock.all?.count || 0, qty: stock.all?.qty || 0 },
    ...(stock.locations || [])
  ];
  const selected = locations.find((location) => String(location.id) === selectedLocationId) || null;

  return {
    locations,
    selected,
    selectedLocationId,
    items: items.data || [],
    message: url.searchParams.get('message') || ''
  };
}

export const actions = {
  dispose: async ({ request, locals }) => {
    requirePermission(locals, ['receive']);

    const form = await request.formData();
    const payload = {
      action: 'disposeItem',
      token: locals.token,
      item_id: String(form.get('item_id') || ''),
      qty: Number(form.get('qty') || 0),
      reason: String(form.get('reason') || 'อื่นๆ'),
      note: String(form.get('note') || '').trim()
    };
    const selectedLocationId = String(form.get('selected_location_id') || 'all');

    if (!payload.item_id || payload.qty <= 0) {
      return fail(400, { message: 'กรุณาเลือกรายการและจำนวนตัดจ่ายให้ถูกต้อง', item_id: payload.item_id });
    }

    const result = await handleApiPayload(payload);
    if (result.status !== 'success') {
      return fail(400, { message: result.message || 'ตัดจ่ายไม่สำเร็จ', item_id: payload.item_id });
    }

    redirect(303, `/stock?location_id=${encodeURIComponent(selectedLocationId)}&message=${encodeURIComponent(result.message || 'ตัดจ่ายแล้ว')}`);
  }
};

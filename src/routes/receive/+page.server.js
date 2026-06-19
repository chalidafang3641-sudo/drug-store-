import { fail, redirect } from '@sveltejs/kit';
import { handleApiPayload } from '../../../server/index.js';

export async function load({ locals }) {
  if (!locals.user) {
    redirect(303, '/login');
  }

  const [drugs, locations, recent] = await Promise.all([
    handleApiPayload({ action: 'getDrugs', token: locals.token }),
    handleApiPayload({ action: 'getLocations', token: locals.token }),
    handleApiPayload({ action: 'recentReceives', token: locals.token, limit: 15 })
  ]);

  if (drugs.status !== 'success' || locations.status !== 'success') {
    redirect(303, '/login');
  }

  const locationList = locations.data || [];
  const defaultLocation = locationList.find((location) => location.is_default_receive) || locationList[0] || null;

  return {
    drugs: drugs.data || [],
    locations: locationList,
    defaultLocationId: defaultLocation?.id || '',
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
      action: 'receiveItem',
      token: locals.token,
      drug_id: String(form.get('drug_id') || ''),
      lot_no: String(form.get('lot_no') || '').trim(),
      expiry_date: String(form.get('expiry_date') || ''),
      qty: Number(form.get('qty') || 0),
      location_id: String(form.get('location_id') || '')
    };

    const sticky = {
      drug_id: payload.drug_id,
      lot_no: payload.lot_no,
      expiry_date: payload.expiry_date,
      qty: payload.qty || 1,
      location_id: payload.location_id
    };

    if (!payload.drug_id || !payload.location_id || !payload.expiry_date || payload.qty <= 0) {
      return fail(400, { message: 'กรุณากรอกข้อมูลรับเข้าให้ครบ', values: sticky });
    }

    const result = await handleApiPayload(payload);
    if (result.status !== 'success') {
      return fail(400, { message: result.message || 'บันทึกรับเข้าไม่สำเร็จ', values: sticky });
    }

    return {
      message: result.message || 'รับเข้าแล้ว',
      item: result.item
    };
  }
};

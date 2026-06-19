import { fail, redirect } from '@sveltejs/kit';
import { handleApiPayload } from '../../../server/index.js';

const roles = [
  { id: 'admin', name: 'ผู้ดูแลระบบ' },
  { id: 'pharmacist', name: 'เภสัชกร' },
  { id: 'staff', name: 'เจ้าหน้าที่' }
];

function hasAdmin(user) {
  return (user?.permissions || []).includes('*');
}

function hasStock(user) {
  const permissions = user?.permissions || [];
  return permissions.includes('*') || permissions.includes('stock');
}

async function api(action, token, params = {}) {
  return handleApiPayload({ action, token, ...params });
}

export async function load({ locals, url }) {
  if (!locals.user) {
    redirect(303, '/login');
  }

  const tab = url.searchParams.get('tab') || 'general';
  const selectedLocationId = url.searchParams.get('location_id') || '';
  const historyType = url.searchParams.get('type') || '';
  const admin = hasAdmin(locals.user);
  const stockAccess = hasStock(locals.user);

  const [locations, history, config, users, selectedItems] = await Promise.all([
    api('getLocations', locals.token),
    api('getHistory', locals.token, { type: historyType, limit: 30 }),
    admin ? api('getConfig', locals.token) : Promise.resolve({ status: 'skipped' }),
    admin ? api('getUsers', locals.token) : Promise.resolve({ status: 'skipped', data: [] }),
    selectedLocationId && stockAccess
      ? api('getLocationItems', locals.token, { location_id: selectedLocationId })
      : Promise.resolve({ status: 'skipped', data: [] })
  ]);

  if (locations.status !== 'success') {
    redirect(303, '/login');
  }

  const locationList = locations.data || [];
  const selectedLocation = locationList.find((location) => location.id === selectedLocationId) || null;

  return {
    tab,
    message: url.searchParams.get('message') || '',
    historyType,
    roles,
    user: locals.user,
    canAdmin: admin,
    canStock: stockAccess,
    locations: locationList,
    selectedLocation,
    selectedItems: selectedItems.status === 'success' ? selectedItems.data || [] : [],
    history: history.status === 'success' ? history.data || [] : [],
    config: config.status === 'success' ? config.config : null,
    users: users.status === 'success' ? users.data || [] : []
  };
}

export const actions = {
  saveConfig: async ({ request, locals }) => {
    if (!locals.user) redirect(303, '/login');

    const form = await request.formData();
    const payload = {
      hospital_name: String(form.get('hospital_name') || '').trim(),
      default_receive_location_id: String(form.get('default_receive_location_id') || ''),
      display_be: form.get('display_be') === 'on',
      expiry_thresholds: {
        critical: Number(form.get('critical') || 0),
        high: Number(form.get('high') || 0),
        medium: Number(form.get('medium') || 0)
      }
    };

    const result = await api('saveConfig', locals.token, { config: payload });
    if (result.status !== 'success') {
      return fail(400, { message: result.message || 'บันทึกการตั้งค่าไม่สำเร็จ' });
    }
    return { ok: true, message: result.message || 'บันทึกการตั้งค่าแล้ว' };
  },

  saveUser: async ({ request, locals }) => {
    if (!locals.user) redirect(303, '/login');

    const form = await request.formData();
    const payload = {
      id: String(form.get('id') || ''),
      username: String(form.get('username') || '').trim(),
      name: String(form.get('name') || '').trim(),
      role: String(form.get('role') || 'staff'),
      password: String(form.get('password') || ''),
      active: form.get('active') === 'on'
    };

    if (!payload.id) delete payload.id;
    if (!payload.password) delete payload.password;

    const result = await api('saveUser', locals.token, { user: payload });
    if (result.status !== 'success') {
      return fail(400, { message: result.message || 'บันทึกผู้ใช้ไม่สำเร็จ' });
    }
    return { ok: true, message: result.message || 'บันทึกผู้ใช้แล้ว' };
  },

  deleteUser: async ({ request, locals }) => {
    if (!locals.user) redirect(303, '/login');

    const form = await request.formData();
    const id = String(form.get('id') || '');
    const result = await api('deleteUser', locals.token, { id });
    if (result.status !== 'success') {
      return fail(400, { message: result.message || 'ลบผู้ใช้ไม่สำเร็จ' });
    }
    return { ok: true, message: result.message || 'ลบผู้ใช้แล้ว' };
  },

  adjust: async ({ request, locals }) => {
    if (!locals.user) redirect(303, '/login');

    const form = await request.formData();
    const selectedLocationId = String(form.get('selected_location_id') || '');
    const payload = {
      item_id: String(form.get('item_id') || ''),
      actual_qty: Number(form.get('actual_qty'))
    };

    if (!payload.item_id || payload.actual_qty < 0 || Number.isNaN(payload.actual_qty)) {
      return fail(400, { message: 'กรุณาเลือกรายการและจำนวนตรวจนับให้ถูกต้อง' });
    }

    const result = await api('adjustItem', locals.token, payload);
    if (result.status !== 'success') {
      return fail(400, { message: result.message || 'บันทึกตรวจนับไม่สำเร็จ' });
    }
    redirect(303, `/settings?tab=audit&location_id=${encodeURIComponent(selectedLocationId)}&message=${encodeURIComponent(result.message || 'บันทึกตรวจนับแล้ว')}`);
  }
};

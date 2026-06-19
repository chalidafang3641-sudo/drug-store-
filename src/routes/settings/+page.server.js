import { Buffer } from 'node:buffer';
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

function hasDrug(user) {
  const permissions = user?.permissions || [];
  return permissions.includes('*') || permissions.includes('drug');
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
  const uploadedImageFileId = url.searchParams.get('uploaded_image_file_id') || '';
  const admin = hasAdmin(locals.user);
  const stockAccess = hasStock(locals.user);
  const drugAccess = hasDrug(locals.user);

  const [locations, history, config, users, drugs, notification, selectedItems] = await Promise.all([
    api('getLocations', locals.token),
    api('getHistory', locals.token, { type: historyType, limit: 30 }),
    admin ? api('getConfig', locals.token) : Promise.resolve({ status: 'skipped' }),
    admin ? api('getUsers', locals.token) : Promise.resolve({ status: 'skipped', data: [] }),
    drugAccess ? api('getDrugs', locals.token) : Promise.resolve({ status: 'skipped', data: [] }),
    admin ? api('getNotifyConfig', locals.token) : Promise.resolve({ status: 'skipped' }),
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
    canDrug: drugAccess,
    locations: locationList,
    drugs: drugs.status === 'success' ? drugs.data || [] : [],
    uploadedImage: uploadedImageFileId
      ? {
          drugId: url.searchParams.get('uploaded_drug_id') || '__new__',
          fileId: uploadedImageFileId,
          url: url.searchParams.get('uploaded_image_url') || ''
        }
      : null,
    selectedLocation,
    selectedItems: selectedItems.status === 'success' ? selectedItems.data || [] : [],
    history: history.status === 'success' ? history.data || [] : [],
    config: config.status === 'success' ? config.config : null,
    notification: notification.status === 'success' ? notification.notification : null,
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

  saveNotification: async ({ request, locals }) => {
    if (!locals.user) redirect(303, '/login');

    const form = await request.formData();
    const payload = {
      enabled: form.get('enabled') === 'on',
      channel: String(form.get('channel') || 'telegram'),
      notify_time: String(form.get('notify_time') || '08:00'),
      telegram_chat_id: String(form.get('telegram_chat_id') || '').trim(),
      telegram_bot_token: String(form.get('telegram_bot_token') || '').trim(),
      line_token: String(form.get('line_token') || '').trim(),
      clear_telegram_token: form.get('clear_telegram_token') === 'on',
      clear_line_token: form.get('clear_line_token') === 'on'
    };

    const result = await api('saveNotifyConfig', locals.token, { notification: payload });
    if (result.status !== 'success') {
      return fail(400, { message: result.message || 'บันทึกการแจ้งเตือนไม่สำเร็จ' });
    }
    return { ok: true, message: result.message || 'บันทึกการแจ้งเตือนแล้ว' };
  },

  testNotification: async ({ locals }) => {
    if (!locals.user) redirect(303, '/login');

    const result = await api('testNotification', locals.token);
    if (result.status !== 'success') {
      return fail(400, { message: result.message || 'ส่งข้อความทดสอบไม่สำเร็จ' });
    }
    return { ok: true, message: result.message || 'ส่งข้อความทดสอบแล้ว' };
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
  },

  saveLocation: async ({ request, locals }) => {
    if (!locals.user) redirect(303, '/login');

    const form = await request.formData();
    const payload = {
      id: String(form.get('id') || ''),
      name: String(form.get('name') || '').trim(),
      icon: String(form.get('icon') || 'box').trim(),
      color: String(form.get('color') || '#16A34A').trim()
    };
    if (!payload.id) delete payload.id;

    const result = await api('saveLocation', locals.token, { location: payload });
    if (result.status !== 'success') {
      return fail(400, { message: result.message || 'บันทึกสถานที่ไม่สำเร็จ' });
    }
    redirect(303, `/settings?tab=locations&message=${encodeURIComponent(result.message || 'บันทึกสถานที่แล้ว')}`);
  },

  deleteLocation: async ({ request, locals }) => {
    if (!locals.user) redirect(303, '/login');

    const form = await request.formData();
    const result = await api('deleteLocation', locals.token, { id: String(form.get('id') || '') });
    if (result.status !== 'success') {
      return fail(400, { message: result.message || 'ลบสถานที่ไม่สำเร็จ' });
    }
    redirect(303, `/settings?tab=locations&message=${encodeURIComponent(result.message || 'ลบสถานที่แล้ว')}`);
  },

  setDefaultReceive: async ({ request, locals }) => {
    if (!locals.user) redirect(303, '/login');

    const form = await request.formData();
    const result = await api('setDefaultReceive', locals.token, { id: String(form.get('id') || '') });
    if (result.status !== 'success') {
      return fail(400, { message: result.message || 'ตั้งจุดรับเข้าไม่สำเร็จ' });
    }
    redirect(303, `/settings?tab=locations&message=${encodeURIComponent(result.message || 'ตั้งจุดรับเข้าแล้ว')}`);
  },

  saveDrug: async ({ request, locals }) => {
    if (!locals.user) redirect(303, '/login');

    const form = await request.formData();
    const payload = {
      id: String(form.get('id') || ''),
      name: String(form.get('name') || '').trim(),
      code: String(form.get('code') || '').trim(),
      unit: String(form.get('unit') || '').trim(),
      min_qty: Number(form.get('min_qty') || 0),
      default_location_id: String(form.get('default_location_id') || ''),
      require_lot: form.get('require_lot') === 'on',
      image_file_id: String(form.get('image_file_id') || ''),
      clear_image: form.get('clear_image') === 'on'
    };
    if (!payload.id) delete payload.id;

    const result = await api('saveDrug', locals.token, { drug: payload });
    if (result.status !== 'success') {
      return fail(400, { message: result.message || 'บันทึกรายการยาไม่สำเร็จ' });
    }
    redirect(303, `/settings?tab=drugs&message=${encodeURIComponent(result.message || 'บันทึกรายการยาแล้ว')}`);
  },

  deleteDrug: async ({ request, locals }) => {
    if (!locals.user) redirect(303, '/login');

    const form = await request.formData();
    const result = await api('deleteDrug', locals.token, { id: String(form.get('id') || '') });
    if (result.status !== 'success') {
      return fail(400, { message: result.message || 'ลบรายการยาไม่สำเร็จ' });
    }
    redirect(303, `/settings?tab=drugs&message=${encodeURIComponent(result.message || 'ลบรายการยาแล้ว')}`);
  },

  uploadDrugImage: async ({ request, locals }) => {
    if (!locals.user) redirect(303, '/login');

    const form = await request.formData();
    const drugId = String(form.get('drug_id') || '__new__');
    const file = form.get('image');

    if (!file || typeof file === 'string' || !file.size) {
      return fail(400, { message: 'กรุณาเลือกรูปยา' });
    }
    if (file.size > 5 * 1024 * 1024) {
      return fail(400, { message: 'ไฟล์รูปต้องไม่เกิน 5MB' });
    }
    if (file.type && !file.type.startsWith('image/')) {
      return fail(400, { message: 'รองรับเฉพาะไฟล์รูปภาพ' });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const base64 = `data:${file.type || 'image/png'};base64,${bytes.toString('base64')}`;
    const result = await api('uploadImage', locals.token, {
      base64,
      filename: file.name || 'drug-image.png'
    });

    if (result.status !== 'success') {
      return fail(400, { message: result.message || 'อัปโหลดรูปยาไม่สำเร็จ' });
    }

    const params = new URLSearchParams({
      tab: 'drugs',
      uploaded_drug_id: drugId,
      uploaded_image_file_id: result.file_id || '',
      uploaded_image_url: result.url || '',
      message: 'อัปโหลดรูปยาแล้ว กดบันทึกยาเพื่อผูกกับรายการ'
    });
    redirect(303, `/settings?${params.toString()}`);
  },

  exportData: async ({ request, locals }) => {
    if (!locals.user) redirect(303, '/login');

    const form = await request.formData();
    const payload = {
      kind: String(form.get('kind') || 'receive'),
      from: String(form.get('from') || ''),
      to: String(form.get('to') || '')
    };
    if (payload.kind === 'stock') {
      payload.from = '';
      payload.to = '';
    }

    const result = await api('exportData', locals.token, payload);
    if (result.status !== 'success') {
      return fail(400, { message: result.message || 'ส่งออกข้อมูลไม่สำเร็จ' });
    }

    return {
      ok: true,
      message: `เตรียมข้อมูล ${result.count || 0} รายการแล้ว`,
      exportResult: {
        kind: payload.kind,
        from: payload.from,
        to: payload.to,
        filename: result.filename || 'drug-store-export.csv',
        columns: result.columns || [],
        rows: result.rows || [],
        count: result.count || 0
      }
    };
  }
};

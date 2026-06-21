import { Buffer } from 'node:buffer';
import { fail, redirect } from '@sveltejs/kit';
import { hasPermission, requirePermission } from '$lib/server/permissions.js';
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

const TAB_PERMISSIONS = {
  menu: ['view'],
  account: ['view'],
  manual: ['view'],
  general: ['*'],
  display: ['view'],
  users: ['*'],
  drugs: ['drug'],
  lot: ['drug'],
  locations: ['drug'],
  notify: ['*'],
  export: ['view'],
  history: ['view'],
  audit: ['stock'],
  report: ['view']
};

async function api(action, token, params = {}) {
  return handleApiPayload({ action, token, ...params });
}

export async function load({ locals, url }) {
  const user = requirePermission(locals, ['view']);

  const tab = url.searchParams.get('tab') || 'menu';
  if (!hasPermission(user, TAB_PERMISSIONS[tab] || ['view'])) {
    redirect(303, '/settings?tab=menu&message=' + encodeURIComponent('ไม่มีสิทธิ์เข้าเมนูนี้'));
  }
  const selectedLocationId = url.searchParams.get('location_id') || '';
  const historyType = url.searchParams.get('type') || '';
  const usersMode = url.searchParams.get('mode') || '';
  const selectedUserId = url.searchParams.get('user_id') || '';
  const manageLocationId = url.searchParams.get('manage_location_id') || '';
  const manageDrugId = url.searchParams.get('manage_drug_id') || '';
  const drugSearch = url.searchParams.get('q') || '';
  const uploadedImageFileId = url.searchParams.get('uploaded_image_file_id') || '';
  const admin = hasAdmin(user);
  const stockAccess = hasStock(user);
  const drugAccess = hasDrug(user);

  const [locations, history, config, users, drugs, notification, selectedItems] = await Promise.all([
    api('getLocations', locals.token),
    api('getHistory', locals.token, { type: historyType, limit: 80 }),
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
  const managedLocation = locationList.find((location) => location.id === manageLocationId) || null;
  const userList = users.status === 'success' ? users.data || [] : [];
  const selectedUser = userList.find((item) => item.id === selectedUserId) || null;
  const drugList = drugs.status === 'success' ? drugs.data || [] : [];
  const managedDrug = drugList.find((item) => item.id === manageDrugId) || null;

  return {
    tab,
    message: url.searchParams.get('message') || '',
    mode: usersMode,
    historyType,
    usersMode,
    drugSearch,
    roles,
    user,
    canAdmin: admin,
    canStock: stockAccess,
    canDrug: drugAccess,
    locations: locationList,
    drugs: drugList,
    uploadedImage: uploadedImageFileId
      ? {
          drugId: url.searchParams.get('uploaded_drug_id') || '__new__',
          fileId: uploadedImageFileId,
          url: url.searchParams.get('uploaded_image_url') || ''
        }
      : null,
    selectedLocation,
    managedLocation,
    managedDrug,
    selectedUser,
    selectedItems: selectedItems.status === 'success' ? selectedItems.data || [] : [],
    history: history.status === 'success' ? history.data || [] : [],
    config: config.status === 'success' ? config.config : null,
    notification: notification.status === 'success' ? notification.notification : null,
    users: userList
  };
}

export const actions = {
  changePassword: async ({ request, locals }) => {
    requirePermission(locals, ['view']);

    const form = await request.formData();
    const payload = {
      old_password: String(form.get('old_password') || ''),
      new_password: String(form.get('new_password') || ''),
      confirm_password: String(form.get('confirm_password') || '')
    };

    if (!payload.old_password || !payload.new_password || !payload.confirm_password) {
      return fail(400, { message: 'กรุณากรอกรหัสผ่านให้ครบ' });
    }
    if (payload.new_password !== payload.confirm_password) {
      return fail(400, { message: 'ยืนยันรหัสผ่านใหม่ไม่ตรงกัน' });
    }

    const result = await api('changePassword', locals.token, payload);
    if (result.status !== 'success') {
      return fail(400, { message: result.message || 'เปลี่ยนรหัสผ่านไม่สำเร็จ' });
    }
    return { ok: true, message: result.message || 'เปลี่ยนรหัสผ่านแล้ว' };
  },

  saveDisplay: async ({ request, locals }) => {
    requirePermission(locals, ['*']);

    const form = await request.formData();
    const result = await api('saveConfig', locals.token, {
      config: { display_be: form.get('display_be') === 'on' }
    });

    if (result.status !== 'success') {
      return fail(400, { message: result.message || 'บันทึกการแสดงผลไม่สำเร็จ' });
    }
    return { ok: true, message: result.message || 'บันทึกการแสดงผลแล้ว' };
  },

  uploadLogo: async ({ request, locals }) => {
    requirePermission(locals, ['*']);

    const form = await request.formData();
    const file = form.get('logo');

    if (!file || typeof file === 'string' || !file.size) {
      return fail(400, { message: 'กรุณาเลือกรูปโลโก้' });
    }
    if (file.size > 4 * 1024 * 1024) {
      return fail(400, { message: 'ไฟล์โลโก้ต้องไม่เกิน 4MB' });
    }
    if (file.type && !file.type.startsWith('image/')) {
      return fail(400, { message: 'รองรับเฉพาะไฟล์รูปภาพ' });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const base64 = `data:${file.type || 'image/png'};base64,${bytes.toString('base64')}`;
    const result = await api('uploadLogo', locals.token, {
      base64,
      filename: file.name || 'hospital-logo.png'
    });

    if (result.status !== 'success') {
      return fail(400, { message: result.message || 'อัปโหลดโลโก้ไม่สำเร็จ' });
    }

    redirect(303, `/settings?tab=general&message=${encodeURIComponent(result.message || 'อัปโหลดโลโก้แล้ว')}`);
  },

  removeLogo: async ({ locals }) => {
    requirePermission(locals, ['*']);

    const result = await api('removeLogo', locals.token);
    if (result.status !== 'success') {
      return fail(400, { message: result.message || 'ลบโลโก้ไม่สำเร็จ' });
    }

    redirect(303, `/settings?tab=general&message=${encodeURIComponent(result.message || 'ลบโลโก้แล้ว')}`);
  },

  setRequireLot: async ({ request, locals }) => {
    requirePermission(locals, ['drug']);

    const form = await request.formData();
    const enabled = form.has('value');
    const result = await api('setRequireLot', locals.token, {
      id: String(form.get('id') || ''),
      value: enabled
    });

    if (result.status !== 'success') {
      return fail(400, { message: result.message || 'อัปเดต Lot required ไม่สำเร็จ' });
    }
    return { ok: true, message: result.message || (enabled ? 'เปิด Lot บังคับ' : 'ปิด Lot บังคับ') };
  },

  saveConfig: async ({ request, locals }) => {
    requirePermission(locals, ['*']);

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
    requirePermission(locals, ['*']);

    const form = await request.formData();
    const isEdit = !!String(form.get('id') || '');
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
    redirect(303, '/settings?tab=users&message=' + encodeURIComponent(result.message || (isEdit ? 'บันทึกผู้ใช้แล้ว' : 'เพิ่มผู้ใช้แล้ว')));
  },

  deleteUser: async ({ request, locals }) => {
    requirePermission(locals, ['*']);

    const form = await request.formData();
    const id = String(form.get('id') || '');
    const result = await api('deleteUser', locals.token, { id });
    if (result.status !== 'success') {
      return fail(400, { message: result.message || 'ลบผู้ใช้ไม่สำเร็จ' });
    }
    redirect(303, '/settings?tab=users&message=' + encodeURIComponent(result.message || 'ลบแล้ว'));
  },

  saveNotification: async ({ request, locals }) => {
    requirePermission(locals, ['*']);

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
    redirect(303, '/settings?tab=notify&message=' + encodeURIComponent(result.message || 'บันทึกการแจ้งเตือนแล้ว'));
  },

  testNotification: async ({ locals }) => {
    requirePermission(locals, ['*']);

    const result = await api('testNotification', locals.token);
    if (result.status !== 'success') {
      return fail(400, { message: result.message || 'ส่งข้อความทดสอบไม่สำเร็จ' });
    }
    redirect(303, '/settings?tab=notify&message=' + encodeURIComponent(result.message || 'ส่งข้อความทดสอบแล้ว'));
  },

  adjust: async ({ request, locals }) => {
    requirePermission(locals, ['stock']);

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
    return {
      ok: true,
      message: result.message || 'บันทึกตรวจนับแล้ว',
      selectedLocationId
    };
  },

  saveLocation: async ({ request, locals }) => {
    requirePermission(locals, ['drug']);

    const form = await request.formData();
    const payload = {
      id: String(form.get('id') || ''),
      name: String(form.get('name') || '').trim(),
      icon: String(form.get('icon') || 'box').trim(),
      color: String(form.get('color') || '#16A34A').trim()
    };
    if (!payload.id) delete payload.id;
    const redirectTo = String(form.get('redirect_to') || '').trim();
    const saveMode = String(form.get('save_mode') || 'manual').trim();

    const result = await api('saveLocation', locals.token, { location: payload });
    if (result.status !== 'success') {
      return fail(400, { message: result.message || 'บันทึกสถานที่ไม่สำเร็จ' });
    }
    if (saveMode === 'autosave') {
      return { ok: true, message: result.message || 'บันทึกสถานที่แล้ว' };
    }
    redirect(303, redirectTo || `/settings?tab=locations&message=${encodeURIComponent(result.message || 'บันทึกสถานที่แล้ว')}`);
  },

  deleteLocation: async ({ request, locals }) => {
    requirePermission(locals, ['drug']);

    const form = await request.formData();
    const redirectTo = String(form.get('redirect_to') || '').trim();
    const result = await api('deleteLocation', locals.token, { id: String(form.get('id') || '') });
    if (result.status !== 'success') {
      return fail(400, { message: result.message || 'ลบสถานที่ไม่สำเร็จ' });
    }
    redirect(303, redirectTo || `/settings?tab=locations&message=${encodeURIComponent(result.message || 'ลบสถานที่แล้ว')}`);
  },

  setDefaultReceive: async ({ request, locals }) => {
    requirePermission(locals, ['drug']);

    const form = await request.formData();
    const redirectTo = String(form.get('redirect_to') || '').trim();
    const result = await api('setDefaultReceive', locals.token, { id: String(form.get('id') || '') });
    if (result.status !== 'success') {
      return fail(400, { message: result.message || 'ตั้งจุดรับเข้าไม่สำเร็จ' });
    }
    redirect(303, redirectTo || `/settings?tab=locations&message=${encodeURIComponent(result.message || 'ตั้งจุดรับเข้าแล้ว')}`);
  },

  reorderLocations: async ({ request, locals }) => {
    requirePermission(locals, ['drug']);

    const form = await request.formData();
    const ids = String(form.get('ids') || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    const redirectTo = String(form.get('redirect_to') || '').trim();

    const result = await api('reorderLocations', locals.token, { ids });
    if (result.status !== 'success') {
      return fail(400, { message: result.message || 'จัดลำดับสถานที่ไม่สำเร็จ' });
    }
    redirect(303, redirectTo || `/settings?tab=locations&message=${encodeURIComponent(result.message || 'จัดลำดับสถานที่แล้ว')}`);
  },

  saveDrug: async ({ request, locals }) => {
    requirePermission(locals, ['drug']);

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
    const redirectTo = String(form.get('redirect_to') || '').trim();

    const result = await api('saveDrug', locals.token, { drug: payload });
    if (result.status !== 'success') {
      return fail(400, { message: result.message || 'บันทึกรายการยาไม่สำเร็จ' });
    }
    redirect(303, redirectTo || `/settings?tab=drugs&message=${encodeURIComponent(result.message || 'บันทึกรายการยาแล้ว')}`);
  },

  deleteDrug: async ({ request, locals }) => {
    requirePermission(locals, ['drug']);

    const form = await request.formData();
    const redirectTo = String(form.get('redirect_to') || '').trim();
    const result = await api('deleteDrug', locals.token, { id: String(form.get('id') || '') });
    if (result.status !== 'success') {
      return fail(400, { message: result.message || 'ลบรายการยาไม่สำเร็จ' });
    }
    redirect(303, redirectTo || `/settings?tab=drugs&message=${encodeURIComponent(result.message || 'ลบรายการยาแล้ว')}`);
  },

  uploadDrugImage: async ({ request, locals }) => {
    requirePermission(locals, ['drug']);

    const form = await request.formData();
    const drugId = String(form.get('drug_id') || '__new__');
    const redirectMode = String(form.get('redirect_mode') || '').trim();
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
    if (drugId !== '__new__') {
      params.set('manage_drug_id', drugId);
    }
    if (redirectMode) {
      params.set('mode', redirectMode);
    }
    redirect(303, `/settings?${params.toString()}`);
  },

  exportData: async ({ request, locals }) => {
    requirePermission(locals, ['view']);

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

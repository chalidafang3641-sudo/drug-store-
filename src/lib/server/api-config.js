import { pool } from './postgres.js';
import { fileUrl, resolveCodeId } from './api-helpers.js';

export async function readConfig() {
  const { rows } = await pool.query(
    `SELECT c.*, l.code_id AS default_receive_location_code_id
     FROM app_config c
     LEFT JOIN locations l ON l.id = c.default_receive_location_id
     WHERE c.id = TRUE`
  );
  return rows[0];
}

export function configOut(config, includeSecrets = true) {
  const out = {
    hospital_name: config.hospital_name,
    logo_file_id: config.logo_file_id,
    logo_url: config.logo_file_id ? fileUrl(config.logo_file_id) : '',
    folder_id: config.folder_id,
    expiry_thresholds: {
      critical: config.expiry_critical_days,
      high: config.expiry_high_days,
      medium: config.expiry_medium_days
    },
    default_receive_location_id: config.default_receive_location_code_id || '',
    notification: {
      enabled: config.notification_enabled,
      channel: config.notification_channel,
      notify_time: config.notify_time,
      telegram_chat_id: config.telegram_chat_id,
      has_telegram: !!config.telegram_bot_token,
      has_line: !!config.line_token,
      has_telegram_token: !!config.telegram_bot_token,
      has_line_token: !!config.line_token
    },
    display_be: config.display_be,
    app_version: config.app_version,
    created_at: toIso(config.created_at),
    updated_at: toIso(config.updated_at)
  };
  if (includeSecrets) {
    out.notification.telegram_bot_token = config.telegram_bot_token;
    out.notification.line_token = config.line_token;
  }
  return out;
}

export async function apiBranding() {
  const config = await readConfig();
  return {
    status: 'success',
    branding: {
      hospital_name: config.hospital_name,
      logo_url: config.logo_file_id ? fileUrl(config.logo_file_id) : '',
      app_name: 'The Watcher',
      app_version: config.app_version,
      thresholds: {
        critical: config.expiry_critical_days,
        high: config.expiry_high_days,
        medium: config.expiry_medium_days
      },
      display_be: config.display_be
    }
  };
}

export async function apiGetConfig() {
  return { status: 'success', config: configOut(await readConfig(), false) };
}

export async function apiSaveConfig(patch = {}) {
  const config = await readConfig();
  const defaultReceiveLocationId = patch.default_receive_location_id !== undefined
    ? await resolveCodeId('locations', patch.default_receive_location_id)
    : config.default_receive_location_id;
  const next = {
    hospital_name: patch.hospital_name !== undefined ? String(patch.hospital_name).trim() : config.hospital_name,
    default_receive_location_id: defaultReceiveLocationId,
    display_be: patch.display_be !== undefined ? !!patch.display_be : config.display_be,
    critical: patch.expiry_thresholds ? Number(patch.expiry_thresholds.critical) : config.expiry_critical_days,
    high: patch.expiry_thresholds ? Number(patch.expiry_thresholds.high) : config.expiry_high_days,
    medium: patch.expiry_thresholds ? Number(patch.expiry_thresholds.medium) : config.expiry_medium_days
  };
  if (!(next.critical > 0 && next.high > next.critical && next.medium > next.high)) {
    return { status: 'error', message: 'ช่วงเตือนต้องเรียงจากน้อยไปมาก' };
  }
  await pool.query(
    `UPDATE app_config
     SET hospital_name = $1, default_receive_location_id = $2, display_be = $3,
         expiry_critical_days = $4, expiry_high_days = $5, expiry_medium_days = $6
     WHERE id = TRUE`,
    [next.hospital_name, next.default_receive_location_id, next.display_be, next.critical, next.high, next.medium]
  );
  return { status: 'success', message: 'บันทึกการตั้งค่าแล้ว', config: { hospital_name: next.hospital_name } };
}

function toIso(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value.toISOString();
}

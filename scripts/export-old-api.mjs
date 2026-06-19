import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_OLD_API_URL = 'https://script.google.com/macros/s/AKfycbzTlKxiQ6-XzJ4xRpLhG_RBw-CyRTbqdjcw3RtNHVi9CbN5WaJhCvilXnIQTusKbBJOOg/exec';

const OLD_API_URL = process.env.OLD_API_URL || DEFAULT_OLD_API_URL;
const OLD_ADMIN_USER = process.env.OLD_ADMIN_USER || 'admin';
const OLD_ADMIN_PASSWORD = process.env.OLD_ADMIN_PASSWORD || '';
const OLD_TOKEN = process.env.OLD_TOKEN || '';
const OLD_HISTORY_LIMIT = Number(process.env.OLD_HISTORY_LIMIT || 100000);
const OUT_DIR = process.env.OLD_EXPORT_DIR || 'legacy-exports';

async function api(action, params = {}, token = '') {
  const body = JSON.stringify({ action, ...params, ...(token ? { token } : {}) });
  const res = await fetch(OLD_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body,
    redirect: 'follow'
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (err) {
    throw new Error(`Legacy API returned non-JSON for ${action}: ${text.slice(0, 200)}`);
  }
  if (data.status === 'error') {
    throw new Error(`${action} failed: ${data.message || data.code || 'unknown error'}`);
  }
  return data;
}

async function getToken() {
  if (OLD_TOKEN) return OLD_TOKEN;
  if (!OLD_ADMIN_PASSWORD) {
    throw new Error('Set OLD_ADMIN_PASSWORD or OLD_TOKEN before exporting legacy data.');
  }
  const login = await api('login', { username: OLD_ADMIN_USER, password: OLD_ADMIN_PASSWORD });
  if (!login.token) throw new Error('Legacy login succeeded but no token was returned.');
  return login.token;
}

function summarize(snapshot) {
  return {
    exported_at: snapshot.exported_at,
    api_url: OLD_API_URL,
    config: snapshot.config ? 1 : 0,
    locations: snapshot.locations.length,
    drugs: snapshot.drugs.length,
    active_items: snapshot.items.length,
    transactions: snapshot.history.length,
    users: snapshot.users.length,
    dashboard_near: snapshot.dashboard?.near?.length || 0,
    dashboard_total_qty: snapshot.dashboard?.summary?.total_qty || 0
  };
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const token = await getToken();
  const [
    config,
    locations,
    drugs,
    items,
    history,
    users,
    dashboard
  ] = await Promise.all([
    api('getConfig', {}, token).catch((err) => ({ export_error: err.message })),
    api('getLocations', {}, token).then((r) => r.data || []),
    api('getDrugs', {}, token).then((r) => r.data || []),
    api('getLocationItems', { location_id: 'all' }, token).then((r) => r.data || []),
    api('getHistory', { limit: OLD_HISTORY_LIMIT }, token).then((r) => r.data || []),
    api('getUsers', {}, token).then((r) => r.data || []).catch((err) => ({ export_error: err.message })),
    api('getDashboard', {}, token).catch((err) => ({ export_error: err.message }))
  ]);

  const snapshot = {
    exported_at: new Date().toISOString(),
    source: 'google-apps-script',
    api_url: OLD_API_URL,
    config: config.config || config,
    locations,
    drugs,
    items,
    history,
    users: Array.isArray(users) ? users : [],
    users_error: Array.isArray(users) ? '' : users.export_error,
    dashboard
  };

  const stamp = snapshot.exported_at.replace(/[:.]/g, '-');
  const snapshotPath = path.join(OUT_DIR, `legacy-snapshot-${stamp}.json`);
  const latestPath = path.join(OUT_DIR, 'legacy-snapshot-latest.json');
  const summaryPath = path.join(OUT_DIR, 'legacy-snapshot-summary.json');
  const summary = summarize(snapshot);

  await fs.writeFile(snapshotPath, JSON.stringify(snapshot, null, 2));
  await fs.writeFile(latestPath, JSON.stringify(snapshot, null, 2));
  await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));

  console.log(JSON.stringify({
    status: 'success',
    snapshot_path: snapshotPath,
    latest_path: latestPath,
    summary_path: summaryPath,
    summary
  }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ status: 'error', message: err.message }, null, 2));
  process.exit(1);
});

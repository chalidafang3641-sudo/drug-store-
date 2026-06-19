import { json } from '@sveltejs/kit';
import { handleApiPayload } from '../../../server/index.js';

async function parsePayload(request) {
  const text = await request.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return Object.fromEntries(new URLSearchParams(text));
  }
}

export async function POST({ request }) {
  try {
    return json(await handleApiPayload(await parsePayload(request)));
  } catch (err) {
    return json({ status: 'error', message: `เกิดข้อผิดพลาด: ${err.message || err}` });
  }
}

export async function GET({ url }) {
  try {
    return json(await handleApiPayload(Object.fromEntries(url.searchParams)));
  } catch (err) {
    return json({ status: 'error', message: `เกิดข้อผิดพลาด: ${err.message || err}` });
  }
}

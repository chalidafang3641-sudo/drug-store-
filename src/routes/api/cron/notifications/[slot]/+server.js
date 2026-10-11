import { GET as scheduledGET } from '../../../notifications/scheduled/+server.js';

export async function GET(event) {
  if (!/^([01]\d|2[0-3])(00|15|30|45)$/.test(event.params.slot)) {
    return Response.json({ ok: false }, { status: 404 });
  }
  return scheduledGET(event);
}

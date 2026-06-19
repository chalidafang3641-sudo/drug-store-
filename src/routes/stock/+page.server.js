import { redirect } from '@sveltejs/kit';
import { handleApiPayload } from '../../../server/index.js';

export async function load({ locals, url }) {
  if (!locals.user) {
    redirect(303, '/login');
  }

  const selectedLocationId = url.searchParams.get('location_id') || 'all';
  const stock = await handleApiPayload({ action: 'getLocationStock', token: locals.token });
  const items = await handleApiPayload({
    action: 'getLocationItems',
    token: locals.token,
    location_id: selectedLocationId
  });

  if (stock.status !== 'success' || items.status !== 'success') {
    redirect(303, '/login');
  }

  const locations = [
    { id: 'all', name: 'รวมทุกสถานที่', color: '#16A34A', count: stock.all?.count || 0, qty: stock.all?.qty || 0 },
    ...(stock.locations || [])
  ];
  const selected = locations.find((location) => location.id === selectedLocationId) || locations[0];

  return {
    locations,
    selected,
    items: items.data || []
  };
}

import { redirect } from '@sveltejs/kit';
import { handleApiPayload } from '../../../server/index.js';

export async function GET({ cookies }) {
  const token = cookies.get('tw_token');
  if (token) {
    await handleApiPayload({ action: 'logout', token }).catch(() => null);
  }
  cookies.delete('tw_token', { path: '/' });
  redirect(303, '/login');
}

import { handleApiPayload } from '../server/index.js';

export async function handle({ event, resolve }) {
  const token = event.cookies.get('tw_token') || '';
  event.locals.token = token;
  event.locals.user = null;

  if (token) {
    const result = await handleApiPayload({ action: 'me', token }).catch(() => null);
    if (result?.status === 'success') {
      event.locals.user = result.user;
    } else {
      event.cookies.delete('tw_token', { path: '/' });
      event.locals.token = '';
    }
  }

  return resolve(event);
}

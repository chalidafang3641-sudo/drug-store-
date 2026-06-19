import { handleApiPayload } from '../../server/index.js';

export async function load({ locals }) {
  const branding = await handleApiPayload({ action: 'branding' }).catch(() => null);

  return {
    user: locals.user,
    branding: branding?.branding ?? {}
  };
}

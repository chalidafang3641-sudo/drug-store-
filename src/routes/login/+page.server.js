import { fail, redirect } from '@sveltejs/kit';
import { handleApiPayload } from '../../../server/index.js';

export async function load({ locals }) {
  if (locals.user) {
    redirect(303, '/dashboard');
  }
}

export const actions = {
  default: async ({ request, cookies }) => {
    const form = await request.formData();
    const username = String(form.get('username') || '').trim();
    const password = String(form.get('password') || '');
    const result = await handleApiPayload({ action: 'login', username, password });

    if (result.status !== 'success') {
      return fail(400, { message: result.message || 'เข้าสู่ระบบไม่ได้', username });
    }

    cookies.set('tw_token', result.token, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 8
    });

    redirect(303, '/dashboard');
  }
};

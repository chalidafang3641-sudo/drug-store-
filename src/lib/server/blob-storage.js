import { get, BlobNotFoundError } from '@vercel/blob';
import './api-runtime.js';

// Only the application's formerly public image namespace can be served here.
export async function serveBlobImage(pathname) {
  if (!/^drugstore-images\/(branding|drug-images)\/.+\.(png|jpe?g|webp|svg)$/i.test(pathname) ||
      /[\\%?#\u0000-\u001f]/.test(pathname) ||
      pathname.split('/').some((part) => part === '..' || part === '.')) {
    return new Response('Not found', { status: 404 });
  }
  const token = process.env.drugs_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return new Response('Image storage unavailable', { status: 503 });
  try {
    const result = await get(pathname, { token, access: 'private' });
    if (!result || result.statusCode !== 200) return new Response('Not found', { status: 404 });
    if (!/^image\/(png|jpeg|webp|svg\+xml)(;|$)/i.test(result.blob.contentType)) {
      await result.stream.cancel();
      return new Response('Not found', { status: 404 });
    }
    return new Response(result.stream, {
      headers: {
        'Content-Type': result.blob.contentType,
        'Cache-Control': 'public, max-age=86400',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "sandbox; default-src 'none'"
      }
    });
  } catch (error) {
    if (error instanceof BlobNotFoundError) return new Response('Not found', { status: 404 });
    console.error('Blob image read failed:', error instanceof Error ? error.name : 'Unknown error');
    return new Response('Image storage unavailable', { status: 502 });
  }
}

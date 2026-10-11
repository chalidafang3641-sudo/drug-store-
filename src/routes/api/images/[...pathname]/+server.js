import { serveBlobImage } from '$lib/server/blob-storage.js';

export async function GET({ params }) {
  return serveBlobImage(params.pathname);
}

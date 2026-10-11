import test from 'node:test';
import assert from 'node:assert/strict';
import { serveBlobImage } from '../src/lib/server/blob-storage.js';
import { fileUrl, saveUpload } from '../src/lib/server/api-helpers.js';

test('image URLs preserve Blob routes and legacy absolute URLs', () => {
  const image = '/api/images/drugstore-images/branding/logo/example.png';
  assert.equal(fileUrl(image), image);
  assert.equal(fileUrl('https://example.com/legacy.jpg'), 'https://example.com/legacy.jpg');
  assert.equal(fileUrl(''), '');
});

test('private store proxy rejects unrelated objects, traversal and non-images', async () => {
  for (const pathname of [
    'secrets/example.png', 'drugstore-images/branding/../secret.png',
    'drugstore-images/branding/%2e%2e/secret.png',
    'drugstore-images/branding/file.html', 'https://example.com/image.png',
    'drugstore-images/branding/file.png?token=value'
  ]) {
    assert.equal((await serveBlobImage(pathname)).status, 404, pathname);
  }
});

test('missing production credentials never fall back to ephemeral disk', async () => {
  const keys = ['drugs_READ_WRITE_TOKEN', 'BLOB_READ_WRITE_TOKEN', 'VERCEL'];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    delete process.env.drugs_READ_WRITE_TOKEN;
    delete process.env.BLOB_READ_WRITE_TOKEN;
    process.env.VERCEL = '1';
    await assert.rejects(saveUpload('aGVsbG8=', 'image.png'), /Vercel Blob/);
    assert.equal((await serveBlobImage('drugstore-images/branding/image.png')).status, 503);
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});

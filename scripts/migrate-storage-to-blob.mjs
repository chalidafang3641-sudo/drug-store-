import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import dotenv from 'dotenv';
import pg from 'pg';
import { put, head, get, BlobNotFoundError } from '@vercel/blob';

// Use the explicit Neon .env rather than the local development database override.
const local = dotenv.parse(await fs.readFile('.env.local'));
const env = { ...local, ...dotenv.parse(await fs.readFile('.env')) };
const args = process.argv.slice(2);
const apply = args.includes('--apply');
const rollback = args.includes('--rollback');
const expectedHost = args.find((arg) => arg.startsWith('--target-host='))?.split('=')[1];
const targetUrl = new URL(process.env.MIGRATION_DATABASE_URL || env.DATABASE_URL);
if (!expectedHost || targetUrl.hostname !== expectedHost) {
  throw new Error('Pass --target-host=<expected Neon hostname> to confirm the target.');
}
if (apply && rollback) throw new Error('Choose --apply or --rollback, not both.');
const token = env.drugs_READ_WRITE_TOKEN || env.BLOB_READ_WRITE_TOKEN;
if (!token) throw new Error('Blob read-write token is missing.');
const projectRef = env.SUPABASE_DB_HOST?.match(/^db\.([a-z0-9]+)\.supabase\.co$/)?.[1];
if (!projectRef) throw new Error('Cannot identify the source Supabase project.');
const sourceOrigin = `https://${projectRef}.supabase.co`;
const directory = path.resolve('output/storage-blob-migration');
const manifestPath = path.join(directory, 'manifest.json');
targetUrl.searchParams.delete('sslmode');
const target = new pg.Client({
  connectionString: targetUrl.toString(), ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000, statement_timeout: 30000
});
const source = new pg.Client({
  host: env.SUPABASE_POOLER_HOST, port: Number(env.SUPABASE_POOLER_PORT || 6543),
  user: env.SUPABASE_POOLER_USER, database: env.SUPABASE_POOLER_DB || 'postgres',
  password: env.SUPABASE_DB_PASSWORD, ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000, statement_timeout: 30000
});
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function download(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`File download failed: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}
async function saveManifest(manifest) {
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  await fs.writeFile(`${manifestPath}.tmp`, JSON.stringify(manifest, null, 2), { mode: 0o600 });
  await fs.rename(`${manifestPath}.tmp`, manifestPath);
}
async function references() {
  return (await target.query(`
    SELECT image_file_id AS url FROM drugs WHERE image_file_id <> ''
    UNION SELECT logo_file_id AS url FROM app_config WHERE logo_file_id <> ''
  `)).rows.map((row) => row.url);
}
async function updateReferences(manifest, reverse = false) {
  const counts = { drugs: 0, branding: 0 };
  await target.query('BEGIN');
  try {
    for (const file of manifest.files) {
      const from = reverse ? file.appUrl : file.sourceUrl;
      const to = reverse ? file.sourceUrl : file.appUrl;
      counts.drugs += (await target.query(
        'UPDATE drugs SET image_file_id = $1 WHERE image_file_id = $2', [to, from]
      )).rowCount;
      counts.branding += (await target.query(
        'UPDATE app_config SET logo_file_id = $1 WHERE logo_file_id = $2', [to, from]
      )).rowCount;
    }
    if (!reverse && (await references()).some((url) => url.startsWith(`${sourceOrigin}/storage/`))) {
      throw new Error('Unmigrated Supabase references remain; rolling back URL updates.');
    }
    await target.query('COMMIT');
  } catch (error) {
    await target.query('ROLLBACK');
    throw error;
  }
  return counts;
}

try {
  await target.connect();
  let manifest;
  try {
    manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    if (manifest.targetHost !== expectedHost || manifest.sourceOrigin !== sourceOrigin ||
        manifest.storeId !== env.drugs_STORE_ID) {
      throw new Error('Existing manifest belongs to a different source, database or Blob store.');
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    manifest = { sourceOrigin, targetHost: expectedHost, storeId: env.drugs_STORE_ID, files: [] };
  }
  if (rollback) {
    if (!manifest.files.length) throw new Error('No migration manifest to roll back.');
    console.log(JSON.stringify({ rolledBack: await updateReferences(manifest, true) }));
  } else {
    await source.connect();
    const { rows: inventory } = await source.query(`
      SELECT b.id AS bucket, b.public, o.name, o.metadata
      FROM storage.buckets b LEFT JOIN storage.objects o ON o.bucket_id = b.id
      WHERE b.id IN ('branding', 'drug-images') ORDER BY b.id, o.name
    `);
    const files = inventory.filter((row) => row.name).map((row) => ({
      ...row,
      sourceUrl: `${sourceOrigin}/storage/v1/object/public/${row.bucket}/${row.name.split('/').map(encodeURIComponent).join('/')}`
    }));
    if (files.some((file) => !file.public)) throw new Error('Private source files cannot use the publicly readable app image route.');
    const refs = await references();
    if (refs.some((url) => url.startsWith(`${sourceOrigin}/storage/`) && !files.some((f) => f.sourceUrl === url))) {
      throw new Error('Database references a source file not present in the inventory.');
    }
    console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', targetHost: expectedHost,
      buckets: [...new Set(inventory.map((row) => row.bucket))], files: files.length,
      bytes: files.reduce((sum, file) => sum + Number(file.metadata?.size || 0), 0) }));
    if (apply) {
      await fs.mkdir(path.join(directory, 'files'), { recursive: true, mode: 0o700 });
      for (const file of files) {
        const bytes = await download(file.sourceUrl);
        if (file.metadata?.size != null && bytes.length !== Number(file.metadata.size)) {
          throw new Error('Source size differs from inventory; restart after uploads have stopped.');
        }
        const hash = sha256(bytes);
        const pathname = `drugstore-images/${file.bucket}/migrated/${hash}/${file.name}`;
        await fs.writeFile(path.join(directory, 'files', hash), bytes, { mode: 0o600 });
        let blob;
        try {
          blob = await head(pathname, { token });
        } catch (error) {
          if (!(error instanceof BlobNotFoundError)) throw error;
          blob = await put(pathname, bytes, { token, access: 'private', addRandomSuffix: false,
            allowOverwrite: false, contentType: file.metadata?.mimetype || 'application/octet-stream' });
        }
        const stored = await get(blob.url, { token, access: 'private' });
        if (!stored || stored.statusCode !== 200 ||
            sha256(Buffer.from(await new Response(stored.stream).arrayBuffer())) !== hash) {
          throw new Error('Blob checksum mismatch.');
        }
        const appUrl = `/api/images/${pathname.split('/').map(encodeURIComponent).join('/')}`;
        const entry = { sourceUrl: file.sourceUrl, blobUrl: blob.url, appUrl, sha256: hash, bytes: bytes.length };
        const previous = manifest.files.find((f) => f.sourceUrl === file.sourceUrl);
        if (previous && previous.sha256 !== hash) throw new Error('Source changed since the previous migration.');
        if (!previous) manifest.files.push(entry);
        await saveManifest(manifest);
      }
      console.log(JSON.stringify({ verifiedFiles: files.length, updated: await updateReferences(manifest), manifestPath }));
    }
  }
} finally {
  await source.end();
  await target.end();
}

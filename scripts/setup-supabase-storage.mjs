import fs from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { Pool } from 'pg';

dotenv.config({ quiet: true });
dotenv.config({ path: '.env.local', override: false, quiet: true });

const assetManifestPath = process.env.LEGACY_ASSET_MANIFEST || 'uploads/legacy-assets/manifest.json';
const createBucketsOnly = process.argv.includes('--buckets-only');
const dryRun = process.argv.includes('--dry-run');
const applyBucketConfig = process.argv.includes('--apply-bucket-config');
const uploadAssets = !createBucketsOnly && !process.argv.includes('--no-upload');

const bucketConfig = {
  branding: { public: true, fileSizeLimit: 5 * 1024 * 1024, allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'] },
  'drug-images': { public: true, fileSizeLimit: 5 * 1024 * 1024, allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'] },
};

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required to create storage buckets.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslConfig(),
});

try {
  const target = validateTarget();
  const buckets = await ensureBuckets();

  if (!uploadAssets) {
    console.log(JSON.stringify({ status: 'success', target, buckets, uploaded: 0, skipped_upload: true, dry_run: dryRun }, null, 2));
    process.exit(0);
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_URL/PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required to upload assets.');
  }

  const manifest = JSON.parse(await fs.readFile(assetManifestPath, 'utf8'));
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const uploadableAssets = (manifest.assets || []).filter((asset) => asset.status === 'downloaded');
  if (dryRun) {
    console.log(JSON.stringify({ status: 'success', target, buckets, dry_run: true, would_upload: uploadableAssets.length }, null, 2));
    process.exit(0);
  }

  const uploadedAssets = [];
  for (const asset of uploadableAssets) {
    const bucket = bucketFor(asset.kind);
    const objectPath = objectPathFor(asset);
    const bytes = await fs.readFile(asset.path);
    const { error } = await supabase.storage
      .from(bucket)
      .upload(objectPath, bytes, {
        contentType: asset.content_type || 'application/octet-stream',
        upsert: true,
      });
    if (error) throw new Error(`Failed to upload ${asset.path}: ${error.message}`);

    const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
    uploadedAssets.push({
      ...asset,
      bucket,
      object_path: objectPath,
      public_url: data.publicUrl,
    });
  }

  const appConfig = await updateAppConfigLogo(uploadedAssets);
  console.log(JSON.stringify({ status: 'success', target, buckets, uploaded: uploadedAssets.length, app_config: appConfig, assets: uploadedAssets }, null, 2));
} finally {
  await pool.end();
}

async function ensureBuckets() {
  const results = [];
  for (const [id, config] of Object.entries(bucketConfig)) {
    const existing = await pool.query(
      'SELECT id, public, file_size_limit, allowed_mime_types FROM storage.buckets WHERE id = $1',
      [id],
    );
    if (existing.rows[0]) {
      const diff = bucketDiff(existing.rows[0], config);
      if (diff.length && !applyBucketConfig) {
        throw new Error(`Bucket ${id} already exists with different config. Re-run with --apply-bucket-config to update: ${JSON.stringify(diff)}`);
      }
      if (diff.length && applyBucketConfig && !dryRun) {
        await pool.query(
          `UPDATE storage.buckets
              SET public = $2,
                  file_size_limit = $3,
                  allowed_mime_types = $4
            WHERE id = $1`,
          [id, config.public, config.fileSizeLimit, config.allowedMimeTypes],
        );
      }
      results.push({ id, action: diff.length ? (applyBucketConfig ? 'updated' : 'diff') : 'unchanged', diff });
      continue;
    }
    if (!dryRun) {
      await pool.query(
        `INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
         VALUES ($1, $1, $2, $3, $4)`,
        [id, config.public, config.fileSizeLimit, config.allowedMimeTypes],
      );
    }
    results.push({ id, action: dryRun ? 'would_create' : 'created', diff: [] });
  }
  return results;
}

async function updateAppConfigLogo(uploadedAssets) {
  const logo = uploadedAssets.find((asset) => asset.kind === 'branding');
  if (!logo) return { updated: false };
  const before = await pool.query('SELECT logo_file_id FROM app_config WHERE id = TRUE');
  await pool.query(
    `UPDATE app_config
        SET logo_file_id = $1
      WHERE id = TRUE`,
    [logo.public_url],
  );
  return { updated: true, old_logo_file_id: before.rows[0]?.logo_file_id || '', new_logo_file_id: logo.public_url };
}

function validateTarget() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL || '';
  const projectRef = process.env.SUPABASE_PROJECT_REF || '';
  if (supabaseUrl.includes('supabase.co')) {
    if (!projectRef) throw new Error('SUPABASE_PROJECT_REF is required for Supabase-hosted storage setup.');
    if (!supabaseUrl.includes(projectRef) || !process.env.DATABASE_URL.includes(projectRef)) {
      throw new Error('SUPABASE_PROJECT_REF does not match SUPABASE_URL/PUBLIC_SUPABASE_URL and DATABASE_URL.');
    }
  }
  return { project_ref: projectRef || 'local', supabase_url: supabaseUrl || '(not set)' };
}

function bucketDiff(existing, desired) {
  const diffs = [];
  if (Boolean(existing.public) !== desired.public) diffs.push({ field: 'public', current: existing.public, desired: desired.public });
  if (Number(existing.file_size_limit) !== desired.fileSizeLimit) diffs.push({ field: 'file_size_limit', current: Number(existing.file_size_limit), desired: desired.fileSizeLimit });
  const currentMime = [...(existing.allowed_mime_types || [])].sort();
  const desiredMime = [...desired.allowedMimeTypes].sort();
  if (JSON.stringify(currentMime) !== JSON.stringify(desiredMime)) diffs.push({ field: 'allowed_mime_types', current: currentMime, desired: desiredMime });
  return diffs;
}

function bucketFor(kind) {
  if (kind === 'branding') return 'branding';
  return 'drug-images';
}

function objectPathFor(asset) {
  const ext = path.extname(asset.path || '') || '.jpg';
  const owner = safePathPart(asset.owner_id || 'asset');
  const source = safePathPart(asset.source_id || path.basename(asset.path || 'asset', ext));
  return `${owner}/${source}${ext}`;
}

function safePathPart(value) {
  return String(value).replace(/[^a-zA-Z0-9._-]+/g, '_');
}

function sslConfig() {
  const value = process.env.PGSSL_REJECT_UNAUTHORIZED;
  if (value == null) return undefined;
  return { rejectUnauthorized: !['0', 'false', 'no'].includes(String(value).toLowerCase()) };
}

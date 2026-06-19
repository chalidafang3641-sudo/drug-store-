import fs from 'node:fs/promises';
import path from 'node:path';

const snapshotPath = process.env.LEGACY_SNAPSHOT || 'legacy-exports/legacy-snapshot-latest.json';
const outDir = process.env.LEGACY_ASSET_DIR || 'uploads/legacy-assets';

const snapshot = JSON.parse(await fs.readFile(snapshotPath, 'utf8'));

const assets = [];

if (snapshot.config?.logo_url) {
  assets.push({
    kind: 'branding',
    source_id: snapshot.config.logo_file_id || 'logo',
    owner_id: 'app_config',
    owner_name: snapshot.config.hospital_name || 'branding',
    url: snapshot.config.logo_url,
  });
}

for (const drug of snapshot.drugs || []) {
  if (!drug.image_url) continue;
  assets.push({
    kind: 'drug',
    source_id: drug.image_file_id || drug.id,
    owner_id: drug.id,
    owner_name: drug.name || drug.code || drug.id,
    url: drug.image_url,
  });
}

const seenItemUrls = new Set(assets.map((asset) => asset.url));
for (const item of snapshot.items || []) {
  if (!item.image_url || seenItemUrls.has(item.image_url)) continue;
  seenItemUrls.add(item.image_url);
  assets.push({
    kind: 'item',
    source_id: item.drug_id || item.id,
    owner_id: item.drug_id || item.id,
    owner_name: item.drug_name || item.id,
    url: item.image_url,
  });
}

await fs.mkdir(outDir, { recursive: true });

const manifest = [];
for (const asset of assets) {
  const folder = path.join(outDir, asset.kind);
  await fs.mkdir(folder, { recursive: true });

  const response = await fetch(asset.url);
  if (!response.ok) {
    manifest.push({ ...asset, status: 'error', error: `${response.status} ${response.statusText}` });
    continue;
  }

  const contentType = response.headers.get('content-type') || '';
  const ext = extensionFor(contentType, asset.url);
  const filename = safeFilename(`${asset.kind}_${asset.source_id}${ext}`);
  const filePath = path.join(folder, filename);
  const bytes = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(filePath, bytes);

  manifest.push({
    ...asset,
    status: 'downloaded',
    content_type: contentType,
    bytes: bytes.length,
    path: filePath,
  });
}

await fs.writeFile(
  path.join(outDir, 'manifest.json'),
  JSON.stringify({ exported_at: new Date().toISOString(), snapshot: snapshotPath, count: manifest.length, assets: manifest }, null, 2),
);

console.log(JSON.stringify({
  snapshot: snapshotPath,
  out_dir: outDir,
  found: assets.length,
  downloaded: manifest.filter((asset) => asset.status === 'downloaded').length,
  errors: manifest.filter((asset) => asset.status === 'error').length,
}, null, 2));

function extensionFor(contentType, url) {
  if (contentType.includes('image/png')) return '.png';
  if (contentType.includes('image/webp')) return '.webp';
  if (contentType.includes('image/svg')) return '.svg';
  if (contentType.includes('image/jpeg') || contentType.includes('image/jpg')) return '.jpg';

  const cleanUrl = url.split('?')[0];
  const ext = path.extname(cleanUrl).toLowerCase();
  if (['.png', '.jpg', '.jpeg', '.webp', '.svg'].includes(ext)) return ext === '.jpeg' ? '.jpg' : ext;
  return '.jpg';
}

function safeFilename(value) {
  return String(value).replace(/[^a-zA-Z0-9._-]+/g, '_');
}

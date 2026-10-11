# Vercel Blob Storage

New logo and drug-image uploads use `@vercel/blob` with the server-only
`drugs_READ_WRITE_TOKEN` variable (or `BLOB_READ_WRITE_TOKEN` as fallback).
The store is private. The API returns `file_id` as an application image path
under `/api/images/drugstore-images/`. Both SvelteKit and Express serve those
images using the server token, which never goes to the browser. The route only
serves image content inside the dedicated `branding` / `drug-images` namespace;
other Blob paths are inaccessible. These app images retain their previous
public-read behavior so the logo also works before login.
Existing Supabase URLs remain readable during rollout. Local development can
use `uploads/` without a token; Vercel rejects uploads if no token is configured.

## Migration

Set `drugs_STORE_ID` and `drugs_READ_WRITE_TOKEN` in `.env` and Production.
Deploy the Blob upload code before copying existing assets so new uploads no
longer go to Supabase. Do not disconnect or delete the source Supabase project.

The script reads source PostgreSQL credentials from `.env.local`, and takes the
destination `DATABASE_URL` from `.env` (or explicit `MIGRATION_DATABASE_URL`).
It only reads `storage.buckets` / `storage.objects` on Supabase. It downloads
public objects from the `branding` and `drug-images` buckets, saves local
backups, copies them to Blob, and compares SHA-256 before changing Neon URLs.
Private source objects or missing source files abort the migration.

```sh
node scripts/migrate-storage-to-blob.mjs --target-host=<Neon-hostname>
node scripts/migrate-storage-to-blob.mjs --target-host=<Neon-hostname> --apply
```

The default is a read-only inventory. `--apply` records a manifest and backups
under the Git-ignored `output/storage-blob-migration/`. Reruns reuse immutable
content-hashed Blob paths and verify their contents. URL changes in `drugs`
and `app_config` are transactional and only replace matching source URLs.
Stock, users, transactions, and notification configuration are not modified.

## Rollback

```sh
node scripts/migrate-storage-to-blob.mjs --target-host=<Neon-hostname> --rollback
```

Rollback uses the saved manifest and only reverses matching migrated URLs.
It does not delete Blob objects or touch later uploads. If reverting the upload
provider as well, redeploy the previous Git revision with its Supabase settings.
Keep the manifest and original Supabase files until rollback is no longer needed.

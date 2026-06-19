# Database Rules

## Schema Direction

- The current Google Sheets / Apps Script data is a baseline and migration source, not the final target model.
- Prefer relational structure over transaction-critical `jsonb`.
- Use real foreign keys where practical.
- Keep stock movement tables traceable and preferably append-only.
- Prefer meaningful business-facing codes for records users reference, such as drug code/barcode and document numbers when added.
- Avoid exposing UUID or opaque surrogate IDs as user-facing identifiers. Use UUID/opaque IDs only as internal primary keys when needed.
- Keep user-facing identifiers in separate business fields such as `code`, `barcode`, or `doc_no`; do not reuse business codes as the database primary key for new design work.
- Preserve barcode/code casing unless a documented business rule says otherwise.
- Use `auth.users` as the authentication source of truth.
- Do not store user passwords in application tables.
- Normalize roles and permissions instead of duplicating permission models.
- Define reconciliation queries for migrated stock and transaction data.

## Environment Rules

- Use a separate Supabase development project for schema work, auth testing, RLS testing, and frontend integration.
- Treat the existing Google Apps Script API and Google Sheets data as read-only migration sources unless the user explicitly asks to change them.
- Do not run destructive operations against any production-like database unless the user explicitly asks and the command scope is clear.
- Apply schema changes to a development Supabase project first.
- Test Supabase Auth and RLS in Supabase, not only in plain local Postgres.
- Verify the target project before running migrations, storage changes, or data imports.

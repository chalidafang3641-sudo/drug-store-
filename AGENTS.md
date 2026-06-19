# Drug Store Agent Rules

## Scope

This repository is being migrated from a static Google Apps Script + Google Sheets app toward a production-ready web app.

Target direction:

- Frontend: SvelteKit on Vercel
- Backend: API routes/server actions, keeping the existing `api(action, params)` contract during the transition
- Database: Supabase Postgres
- File storage: Supabase Storage
- Notifications: Vercel Cron or Supabase Edge Functions

## Must Follow

- Use Thai for user-facing explanations unless the user asks otherwise.
- Follow `/Users/watcharathatsrithanesiganon/.codex/RTK.md`: prefix shell commands with `rtk`.
- Do not commit secrets, `.env`, production exports, database dumps, or uploaded files.
- Preserve the existing business flows while migrating: login, receive stock, dashboard, location stock, exchange/move stock, dispose/adjust, settings, users, export, notifications.
- Split migration work into small, reviewable batches. Avoid framework migration, database redesign, auth redesign, and UI redesign in one batch.
- Keep the action-based API contract working until the replacement UI is fully stable.
- Prefer relational Postgres tables and real foreign keys for stock-critical data.
- Do not store plaintext passwords. If Supabase Auth is adopted, use `auth.users` as the source of truth.
- For Supabase work, read `.agents/skills/supabase/SKILL.md` first.
- For large refactors, read `.agents/skills/codebase-migrate/SKILL.md` first.
- For database/schema work, use `docs/agent-rules/database.md`.
- For form/API field changes, use `docs/agent-rules/validation.md`.
- For browser checks, use `.agents/skills/webapp-testing/SKILL.md`.

## Validation Baseline

For current Node backend work:

```bash
rtk npm run check
```

For future SvelteKit work, add and run lint/type-check/build scripts before claiming completion.

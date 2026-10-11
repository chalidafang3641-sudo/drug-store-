# Notification scheduling

## Runtime

- Cloudflare Worker `drugstore-notification-cron` runs every minute and sends an authenticated POST to `https://drug-store-pi.vercel.app/api/notifications/scheduled`.
- The API reads the latest Neon configuration on every call. Bangkok `notify_time`, the global switch and independent LINE/Telegram switches determine which channels are due. Saving configuration never invokes a deployment API.
- The existing unique database key `(delivery_day, channel, scheduled_time)` prevents overlapping ticks from sending the same slot twice. Changing the time creates a different slot, including later on the same day. Late ticks catch up within the same Bangkok calendar day.
- Failed or uncertain provider deliveries remain claimed: they are not automatically retried because the provider may have accepted a request before a timeout. HTTP/connection failures before claiming are retried by the next minute tick. Inspect `notification_deliveries` and logs before any manual retry; do not blindly delete claims.
- A recent authenticated POST updates `notification_scheduler_last_tick`. Settings refreshes this status every 15 seconds; after three minutes without contact it reports unavailable. This confirms scheduler contact, not successful message delivery.
- Vercel retains only the two existing database keepalives. GET on the former notification cron endpoint returns 405. GitHub scheduling remains unused.

## Deployment

1. Apply `db/migrations/20261011_cloudflare_scheduler.sql` to Neon before the application deployment. The previous config-driven cron migration must already be applied.
2. Set matching `NOTIFY_SCHEDULE_SECRET` values in Vercel Production and the Cloudflare Worker secret store. Never commit the value or use a public environment variable.
3. Deploy the application to Vercel. This removes notification cron registration and the old save-time redeploy behavior. Existing `NOTIFY_VERCEL_*` credentials are no longer used and may be removed after cutover verification.
4. Deploy `cloudflare/notification-cron/wrangler.jsonc` using Wrangler and install the Worker secret. `workers_dev` and preview URLs are disabled; only the scheduled handler dispatches.
5. Wait for Cloudflare trigger propagation. Verify automatic Worker events, recent database heartbeat, and separate per-channel delivery records. Do not manually trigger a real send to prove the scheduler works.

Normal changes to notification time or credentials require only saving settings, not deployment. Cloudflare and provider/network delays remain possible; this is not an exact-second guarantee. One-minute polling also generates Vercel requests and database activity, which consume their respective plan quotas.

## Tests

Run `node --test tests/notification-schedule.test.mjs tests/notification-schedule-sync.test.mjs`, `npm run check:svelte`, and `npm run build`. Worker tests use mocked HTTP responses and do not send production notifications.

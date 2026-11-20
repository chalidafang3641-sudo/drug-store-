# Notification scheduling

Cloudflare stores one daily alarm for the shop in the StoreSchedule Durable Object. Saving notification settings synchronizes the alarm with the current D1 configuration. Disabling notifications clears it. The time uses Asia/Bangkok. The Worker checks D1 again when the alarm fires and sends the dated slot to Vercel. The delivery table tracks each channel separately.

Deploy the notification Worker with its D1 and Durable Object bindings. Configure the same CONTROL_KEY (Worker) and NOTIFY_CONTROL_KEY (Vercel), set NOTIFY_CONTROL_URL to the Worker's /schedule URL, and retain matching NOTIFY_SCHEDULE_SECRET values for dispatch. Initialize the alarm with an authenticated POST to /schedule and verify it with GET. The Worker has an empty cron list.

# Notification content settings

Apply `db/migrations/20261013_notification_expiry.sql` before deploying this version.
Notification expiry criteria are independent of Dashboard thresholds:
`notify_expiry_days` defaults to 30 (integer 0-3650), and
`notify_include_expired` defaults to true. The settings page offers presets and
custom days. Active lots with positive quantity and expiry on or before the
Bangkok calendar date plus the configured days are included. Turning off expired
lots adds a lower bound of today; lots expiring today are always included.
The expiry query has no row limit. Messages are split into parts of at most
4000 UTF-16 code units without dropping text. Low-stock content remains unchanged.
Existing delivery claims and schedule times are unchanged. A partial provider
failure is not automatically retried; some parts may already have arrived.

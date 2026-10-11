# Notification scheduling

- LINE and Telegram have independent enable flags, credentials and test buttons.
- Existing enabled-channel selection is preserved by `20261011_notification_channels.sql`; migration does not enable another channel automatically.
- The global enable switch and `notify_time` apply to both channels. Time zone: Asia/Bangkok.
- Vercel calls `/api/cron/notifications/HHMM`. `vercel.json` contains 96 separate daily jobs spaced at 15-minute nominal intervals in UTC. Each job runs once per day, within Hobby's daily-per-job constraint and 100-job project limit (98 including two keepalives).
- Every invocation reads the current database config; changing config does not need deployment. GitHub is used for source control only; the GitHub scheduler workflow has been removed.
- Set `CRON_SECRET` in Vercel Production. Vercel supplies it as `Authorization: Bearer ...`. Never commit its value. The older POST endpoint remains protected by `NOTIFY_SCHEDULE_SECRET` for explicit manual use, but no scheduler uses it.
- Apply both notification migrations before deploying. The existing Vercel morning/evening jobs remain database-only keepalives.
- Hobby jobs may be invoked anywhere within the scheduled hour. The 15-minute nominal spacing is not a 15-minute delivery SLA. The first invocation at or after config time attempts delivery; near midnight a late invocation may miss that day's window. Exact-minute schedules require a platform with that guarantee.
- Verify project `crons.definitions`, enabled state and deployment ID after release. Registration and deployment READY are not proof that an automatic invocation has occurred. Inspect Vercel logs for `Scheduled notifications` with `source: vercel`, then `notification_deliveries` for provider acceptance.
- A unique `(delivery_day, channel)` claim prevents duplicate sends on concurrent or repeated ticks. The first tick after the configured time sends, even if late that day. Already claimed channels do not resend when config changes that day.
- Each channel is attempted independently. Provider failures do not prevent the other channel from being attempted.
- Failed or uncertain (`sending`) deliveries are not automatically retried, because the provider may have accepted a message before a timeout. Review `notification_deliveries` and use the channel-specific test button for a deliberate manual send.
- Test buttons use saved credentials, bypass the enable switch, and do not count toward scheduled daily delivery.
- Do not invoke the authenticated scheduled endpoint casually: after the configured time it can send real messages.

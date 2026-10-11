# Notification scheduling

- LINE and Telegram have independent enable flags, credentials and test buttons.
- Existing enabled-channel selection is preserved by `20261011_notification_channels.sql`; migration does not enable another channel automatically.
- The global enable switch and `notify_time` apply to both channels. Time zone: Asia/Bangkok.
- GitHub Actions calls `/api/notifications/scheduled` every five minutes. The endpoint checks the current database config on every invocation; changing config does not need deployment.
- Set the same `NOTIFY_SCHEDULE_SECRET` in GitHub repository Actions secrets and Vercel Production environment. Never commit its value.
- Apply both notification migrations before deploying. The existing Vercel morning/evening jobs remain database-only keepalives.
- GitHub schedule execution can be delayed. This is not an exact-minute delivery guarantee. Public-repository schedules may be disabled after 60 days of inactivity; check Actions periodically.
- A unique `(delivery_day, channel)` claim prevents duplicate sends on concurrent or repeated ticks. The first tick after the configured time sends, even if late that day. Already claimed channels do not resend when config changes that day.
- Each channel is attempted independently. Provider failures do not prevent the other channel from being attempted.
- Failed or uncertain (`sending`) deliveries are not automatically retried, because the provider may have accepted a message before a timeout. Review `notification_deliveries` and use the channel-specific test button for a deliberate manual send.
- Test buttons use saved credentials, bypass the enable switch, and do not count toward scheduled daily delivery.
- Do not invoke the authenticated scheduled endpoint casually: after the configured time it can send real messages.

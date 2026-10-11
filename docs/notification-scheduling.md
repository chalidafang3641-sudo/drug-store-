# Notification scheduling

- LINE and Telegram have independent credentials, enable switches and test buttons. The global switch and Bangkok notify_time apply to both.
- Production has one daily notification job at /api/notifications/scheduled and two database keepalives. GitHub Actions and the former 96 polling jobs are not used.
- npm run build runs scripts/build-notification-cron.mjs after SvelteKit. It reads the latest database config and writes three cron definitions to .vercel/output/config.json using Vercel's Build Output API.
- Bangkok 20:37 becomes UTC 37 13 * * *. Every deployment rereads the database, so a static repository schedule cannot overwrite a newer user setting.
- Saving settings calls the server-only synchronizer. A matching active schedule requires no deployment. Otherwise it redeploys current production source, whose build reads the latest saved time.
- A matching pending deployment is reused. Settings displays pending, active or failure/mismatch by checking actual Vercel cron definitions. Pending state refreshes every 15 seconds without replacing unsaved inputs.
- Failed synchronization retains saved credentials and explicitly reports scheduling failure. Save again to retry.
- Required production server variables: NOTIFY_VERCEL_TOKEN, NOTIFY_VERCEL_PROJECT_ID, NOTIFY_VERCEL_TEAM_ID, CRON_SECRET and the database connection. Never expose their values to the browser or repository.
- CRON_SECRET authenticates Vercel GET requests. The legacy POST endpoint uses NOTIFY_SCHEDULE_SECRET separately and is not used by the scheduler.
- Apply 20261011_config_driven_cron.sql before deployment. It adds deployment tracking and duplicate protection by (delivery_day, channel, scheduled_time). A new time can send again that day; repeated calls for the same time cannot.
- Failed/uncertain sends are not retried automatically because providers may have accepted a timed-out request. Test buttons explicitly send using saved credentials without consuming the scheduled slot.
- Hobby timing is approximate within the scheduled hour. A changed time takes effect only after deployment. If that time has passed by activation, the next automatic invocation may be the following day.
- Verify actual project definitions and deployment ID, then separately inspect automatic logs (source: vercel) and notification_deliveries for provider acceptance. Do not prove scheduling by manually sending.

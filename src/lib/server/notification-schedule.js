export function dueNotificationChannels(config, now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(now).map(({ type, value }) => [type, value]));
  const day = `${parts.year}-${parts.month}-${parts.day}`;
  const time = `${parts.hour}:${parts.minute}`;
  if (!config.enabled || !/^([01]\d|2[0-3]):[0-5]\d$/.test(config.notify_time || '') || time < config.notify_time) {
    return { day, channels: [] };
  }
  return { day, channels: ['line', 'telegram'].filter((channel) => config[`${channel}_enabled`]) };
}

export async function dispatchScheduledNotifications({ config, query, dispatch, now }) {
  const { day, channels } = dueNotificationChannels(config, now);
  const results = [];
  for (const channel of channels) {
    // Claim before sending: concurrent ticks cannot duplicate a daily message.
    // Failed/uncertain deliveries require manual retry rather than automatic duplicates.
    const claim = await query(`INSERT INTO notification_deliveries (delivery_day, channel, scheduled_time, status)
      VALUES ($1, $2, $3, 'sending') ON CONFLICT (delivery_day, channel, scheduled_time) DO NOTHING RETURNING channel`, [day, channel, config.notify_time]);
    if (!claim.rowCount) continue;
    let status;
    try {
      const result = await dispatch(channel);
      status = result.skipped ? 'skipped' : result.status === 'success' ? 'sent' : 'failed';
    } catch {
      status = 'failed';
    }
    await query('UPDATE notification_deliveries SET status = $3, updated_at = now() WHERE delivery_day = $1 AND channel = $2 AND scheduled_time = $4', [day, channel, status, config.notify_time]);
    results.push({ channel, status });
  }
  return { ok: results.every((result) => result.status !== 'failed'), results };
}

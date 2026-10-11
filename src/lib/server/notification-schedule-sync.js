export function notificationScheduleStatus(config, now = new Date()) {
  const lastTick = config.notification_scheduler_last_tick;
  const age = lastTick ? now.getTime() - new Date(lastTick).getTime() : NaN;
  return {
    state: Number.isFinite(age) && age >= 0 && age < 180000 ? 'active' : 'unavailable',
    time: config.notify_time,
    lastTick: Number.isFinite(age) ? new Date(lastTick).toISOString() : null
  };
}

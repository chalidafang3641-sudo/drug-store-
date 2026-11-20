export async function notificationScheduleStatus(config, sync = false) {
  try {
    const response = await fetch(process.env.NOTIFY_CONTROL_URL, {
      method:sync ? 'POST' : 'GET',
      headers:{authorization:'Bearer ' + process.env.NOTIFY_CONTROL_KEY},
      redirect:'error', cache:'no-store', signal:AbortSignal.timeout(12000)
    });
    if (response.ok) {
      const schedule = await response.json();
      if (schedule.time === config.notify_time && schedule.state === (config.notification_enabled ? 'active' : 'disabled')) return schedule;
    }
  } catch { /* Surface the failed synchronization to the settings form. */ }
  return {state:'unavailable',time:config.notify_time};
}

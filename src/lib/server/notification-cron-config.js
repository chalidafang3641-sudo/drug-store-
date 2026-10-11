export const notificationCronPath = '/api/notifications/scheduled';

export function notificationCron(time) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time || '')) throw new Error('Invalid notification time');
  const [hour, minute] = time.split(':').map(Number);
  return { path: notificationCronPath, schedule: `${minute} ${(hour + 17) % 24} * * *` };
}

export function deploymentCrons(time) {
  return [
    { path: '/api/cron/supabase-keepalive', schedule: '0 0 * * *' },
    { path: '/api/cron/supabase-keepalive-evening', schedule: '0 11 * * *' },
    notificationCron(time)
  ];
}

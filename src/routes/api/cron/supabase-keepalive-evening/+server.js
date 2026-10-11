import { createNotificationCron } from '$lib/server/notification-cron.js';
import { runNotificationDispatch } from '../../../../../server/index.js';

export const GET = createNotificationCron({
  dispatch: () => runNotificationDispatch(),
  getSecret: () => process.env.CRON_SECRET || ''
});

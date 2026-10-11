import { notificationCron } from './notification-cron-config.js';

function settings() {
  return {
    token: process.env.NOTIFY_VERCEL_TOKEN,
    project: process.env.NOTIFY_VERCEL_PROJECT_ID,
    team: process.env.NOTIFY_VERCEL_TEAM_ID
  };
}

async function request(path, options = {}) {
  const { token, team } = settings();
  if (!token || !team) throw new Error('Schedule sync not configured');
  const response = await fetch(`https://api.vercel.com${path}${path.includes('?') ? '&' : '?'}teamId=${encodeURIComponent(team)}`, {
    ...options,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error(`Schedule API status ${response.status}`);
  return response.json();
}

export async function notificationScheduleStatus(config) {
  const desired = notificationCron(config.notify_time);
  try {
    const { project } = settings();
    if (!project) throw new Error('Schedule project missing');
    const state = await request(`/v9/projects/${encodeURIComponent(project)}`);
    const definitions = state.crons?.definitions || [];
    const active = !state.crons?.disabledAt && definitions.length === 3 && definitions.some((job) => job.path === desired.path && job.schedule === desired.schedule);
    if (active) return { state: 'active', time: config.notify_time };
    if (config.notification_schedule_deployment_id) {
      const deployment = await request(`/v13/deployments/${encodeURIComponent(config.notification_schedule_deployment_id)}`);
      if (deployment.meta?.notificationTime === config.notify_time && ['QUEUED', 'INITIALIZING', 'BUILDING'].includes(deployment.readyState || deployment.status)) {
        return { state: 'pending', time: config.notify_time };
      }
    }
    return { state: 'mismatch', time: config.notify_time };
  } catch {
    return { state: 'unavailable', time: config.notify_time };
  }
}

export async function syncNotificationSchedule(config, query) {
  const status = await notificationScheduleStatus(config);
  if (['active', 'pending'].includes(status.state)) return status;
  try {
    const { project } = settings();
    const state = await request(`/v9/projects/${encodeURIComponent(project)}`);
    if (!state.crons?.deploymentId) throw new Error('Production deployment missing');
    const deployment = await request('/v13/deployments', {
      method: 'POST',
      body: JSON.stringify({ name: state.name, project, deploymentId: state.crons.deploymentId, target: 'production', meta: { notificationTime: config.notify_time } })
    });
    if (!deployment.id) throw new Error('Deployment ID missing');
    await query('UPDATE app_config SET notification_schedule_deployment_id = $1 WHERE id = TRUE AND notify_time = $2', [deployment.id, config.notify_time]);
    return { state: 'pending', time: config.notify_time };
  } catch {
    return { state: 'failed', time: config.notify_time };
  }
}

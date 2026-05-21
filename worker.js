import openNextWorker from './.open-next/worker.js';

export { BucketCachePurge, DOQueueHandler, DOShardedTagCache } from './.open-next/worker.js';

const CRON_JOBS = [
  { path: '/api/cron/show-lifecycle', schedule: '* * * * *' },
  { path: '/api/cron/expire-reservations', schedule: '*/5 * * * *' },
  { path: '/api/cron?job=digest', schedule: '0 10 * * 1' },
  { path: '/api/cron?job=health-check', schedule: '*/15 * * * *' },
  { path: '/api/cron?job=artist-digest', schedule: '0 10 * * 2' },
  { path: '/api/cron?job=onboarding', schedule: '0 9 * * *' },
  { path: '/api/cron?job=show-reminders', schedule: '0 */6 * * *' },
  { path: '/api/cron?job=db-health', schedule: '0 8 * * 1' },
  { path: '/api/cron?job=weekly-picks', schedule: '0 9 * * 5' },
  { path: '/api/cron?job=admin-report', schedule: '0 8 * * 1' },
  { path: '/api/cron?job=new-to-scene', schedule: '0 10 * * 3' },
  { path: '/api/cron?job=expire-ads', schedule: '0 3 * * *' },
  { path: '/api/cron?job=feature-shows', schedule: '0 6 * * *' },
  { path: '/api/cron?job=flag-spam', schedule: '0 4 * * *' },
  { path: '/api/cron?job=show-payouts', schedule: '0 5 * * *' },
  { path: '/api/cron?job=artist-onboarding', schedule: '0 11 * * *' },
  { path: '/api/cron?job=close-stale-bookings', schedule: '0 3 * * *' },
  { path: '/api/cron?job=follow-digest', schedule: '0 9 * * *' },
  { path: '/api/cron?job=session-cleanup', schedule: '0 2 * * 0' },
  { path: '/api/cron?job=audit-log-rotate', schedule: '0 1 * * 0' },
  { path: '/api/cron?job=stripe-connect-health', schedule: '0 8 * * 1' }
];

function matchesCronField(field, value) {
  if (field === '*') return true;

  if (field.startsWith('*/')) {
    const interval = Number(field.slice(2));
    return Number.isInteger(interval) && interval > 0 && value % interval === 0;
  }

  return field.split(',').some((part) => Number(part) === value);
}

function isCronDue(schedule, date) {
  const [minute, hour, dayOfMonth, month, dayOfWeek] = schedule.split(' ');
  return (
    matchesCronField(minute, date.getUTCMinutes()) &&
    matchesCronField(hour, date.getUTCHours()) &&
    matchesCronField(dayOfMonth, date.getUTCDate()) &&
    matchesCronField(month, date.getUTCMonth() + 1) &&
    matchesCronField(dayOfWeek, date.getUTCDay())
  );
}

async function runCronJob(job, env, ctx) {
  const baseUrl = env.NEXT_PUBLIC_BASE_URL || env.AUTH_URL || 'https://ihype.org';
  const url = new URL(job.path, baseUrl);
  const headers = new Headers({
    'user-agent': 'ihype-cloudflare-cron',
    'x-ihype-cron-schedule': job.schedule
  });

  if (env.CRON_SECRET) {
    headers.set('authorization', `Bearer ${env.CRON_SECRET}`);
  }

  const response = await openNextWorker.fetch(new Request(url, { headers }), env, ctx);
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    console.error(`[cron] ${job.path} failed with ${response.status}`, body.slice(0, 500));
  }
}

async function runScheduledCrons(event, env, ctx) {
  const scheduledTime = typeof event.scheduledTime === 'number' ? event.scheduledTime : Date.now();
  const now = new Date(scheduledTime);
  const dueJobs = CRON_JOBS.filter((job) => isCronDue(job.schedule, now));

  await Promise.allSettled(dueJobs.map((job) => runCronJob(job, env, ctx)));
}

export default {
  fetch(request, env, ctx) {
    return openNextWorker.fetch(request, env, ctx);
  },

  scheduled(event, env, ctx) {
    const work = runScheduledCrons(event, env, ctx);
    ctx.waitUntil(work);
    return work;
  }
};

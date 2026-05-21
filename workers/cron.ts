/**
 * Cloudflare Worker: cron dispatcher
 *
 * Cloudflare Pages does not support scheduled() handlers — cron triggers are
 * a Workers-only feature. This lightweight worker runs alongside the Pages app
 * and calls the Next.js cron HTTP routes with the shared CRON_SECRET.
 *
 * Deploy with: wrangler deploy --config wrangler.cron.toml
 */

type Env = {
  APP_BASE_URL: string;
  CRON_SECRET: string;
};

type ScheduledEvent = { cron: string; scheduledTime: number };
type ExecutionContext = { waitUntil(p: Promise<unknown>): void; passThroughOnException(): void };

type CronJob = {
  path: string;
  schedule: string;
};

const JOBS: CronJob[] = [
  { path: '/api/cron/expire-reservations', schedule: '*/5 * * * *' },
  { path: '/api/cron/show-lifecycle', schedule: '* * * * *' },
];

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const matched = JOBS.filter((job) => job.schedule === event.cron);

    if (matched.length === 0) {
      console.warn(`[cron] No job matched schedule: ${event.cron}`);
      return;
    }

    await Promise.all(
      matched.map(async (job) => {
        const url = `${env.APP_BASE_URL}${job.path}`;
        try {
          const res = await fetch(url, {
            method: 'GET',
            headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
          });
          if (!res.ok) {
            const body = await res.text().catch(() => '');
            console.error(`[cron] ${job.path} → ${res.status}: ${body}`);
          } else {
            console.log(`[cron] ${job.path} → ${res.status}`);
          }
        } catch (err) {
          console.error(`[cron] ${job.path} fetch failed:`, err);
        }
      })
    );
  },
};

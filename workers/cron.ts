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
  // Infrastructure — every 5 min
  { path: '/api/cron/show-lifecycle',       schedule: '*/5 * * * *'  },
  { path: '/api/cron/expire-reservations',  schedule: '*/5 * * * *'  },

  // Health & monitoring — every 6 hours
  { path: '/api/cron?job=health-check',     schedule: '0 */6 * * *'  },
  { path: '/api/cron?job=db-health',        schedule: '0 */6 * * *'  },

  // Daily jobs — staggered to avoid spikes
  { path: '/api/cron?job=digest',           schedule: '0 8 * * *'    },
  { path: '/api/cron?job=new-to-scene',     schedule: '0 10 * * *'   },
  { path: '/api/cron?job=show-reminders',   schedule: '0 12 * * *'   },
  { path: '/api/cron?job=onboarding',       schedule: '0 14 * * *'   },
  { path: '/api/cron?job=expire-ads',       schedule: '0 2 * * *'    },
  { path: '/api/cron?job=session-cleanup',  schedule: '0 3 * * *'    },
  { path: '/api/cron?job=feature-shows',    schedule: '0 6 * * *'    },

  // Weekly jobs — Monday morning
  { path: '/api/cron?job=weekly-picks',       schedule: '0 9 * * 1'   },
  { path: '/api/cron?job=artist-digest',      schedule: '0 9 * * 1'   },
  { path: '/api/cron?job=admin-report',       schedule: '0 9 * * 1'   },
  { path: '/api/cron?job=follow-digest',      schedule: '0 9 * * 1'   },
  { path: '/api/cron?job=audit-log-rotate',   schedule: '0 4 * * 1'   },

  // Additional daily jobs
  { path: '/api/cron?job=close-stale-bookings',  schedule: '0 1 * * *'   },
  { path: '/api/cron?job=artist-onboarding',     schedule: '0 11 * * *'  },
  { path: '/api/cron?job=show-payouts',          schedule: '0 13 * * *'  },
  { path: '/api/cron?job=stripe-connect-health', schedule: '0 */6 * * *' },
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

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
  /**
   * Optional outbound heartbeat (Healthchecks.io, Better Stack, Cronitor —
   * any service that alerts when an expected ping stops arriving).
   *
   * This is the only alarm iHYPE has that lives outside iHYPE. Everything
   * else is downstream of the thing it watches: checkCronHealth() is invoked
   * by a cron job, the workbench digest is sent by a cron job, and Sentry
   * only hears about errors a running Worker manages to report. If this
   * Worker stops being scheduled at all, none of them fire and the silence
   * is indistinguishable from "nothing is wrong" — which is exactly how a
   * previous outage ran for a day unnoticed.
   *
   * A missing ping is the signal. Set the check's expected period to ~10
   * minutes, since the every-5-minutes schedule fires twice in that window.
   */
  HEARTBEAT_URL?: string;
};

type ScheduledEvent = { cron: string; scheduledTime: number };
type ExecutionContext = { waitUntil(p: Promise<unknown>): void; passThroughOnException(): void };

type CronJob = {
  path: string;
  schedule: string;
};

const PRODUCTION_SMOKE_PATHS = ['/', '/login', '/shows', '/listen', '/pages', '/status'] as const;

const JOBS: CronJob[] = [
  // Infrastructure — every 5 min
  { path: '/api/cron/show-lifecycle',       schedule: '*/5 * * * *'  },
  { path: '/api/cron/expire-reservations',  schedule: '*/5 * * * *'  },
  { path: '/api/cron/notification-jobs',    schedule: '*/5 * * * *'  },

  // Health & monitoring — every 6 hours
  { path: '/api/cron?job=health-check',     schedule: '0 */6 * * *'  },
  { path: '/api/cron?job=db-health',        schedule: '0 */6 * * *'  },

  // Daily jobs — staggered to avoid spikes
  { path: '/api/cron?job=digest',           schedule: '0 8 * * *'    },
  { path: '/api/cron?job=new-to-scene',     schedule: '0 10 * * *'   },
  { path: '/api/cron?job=show-reminders',   schedule: '0 12 * * *'   },
  { path: '/api/cron?job=onboarding',       schedule: '0 14 * * *'   },
  { path: '/api/cron/welcome-sequence',     schedule: '0 15 * * *'   },
  { path: '/api/cron?job=session-cleanup',  schedule: '0 3 * * *'    },
  { path: '/api/cron?job=push-cleanup',     schedule: '0 3 * * *'    },
  { path: '/api/cron?job=identity-detach',  schedule: '0 3 * * *'    },
  { path: '/api/cron?job=feature-shows',    schedule: '0 6 * * *'    },

  // Weekly jobs — Monday morning
  { path: '/api/cron?job=weekly-picks',       schedule: '0 9 * * 1'   },
  { path: '/api/cron?job=artist-digest',      schedule: '0 9 * * 1'   },
  { path: '/api/cron?job=workbench-digest',   schedule: '0 12 * * *'  },
  { path: '/api/cron?job=held-track-notice', schedule: '0 12 * * *'  },
  { path: '/api/cron?job=admin-report',       schedule: '0 9 * * 1'   },
  { path: '/api/cron?job=follow-digest',      schedule: '0 9 * * 1'   },
  { path: '/api/cron/weekly-digest',           schedule: '0 9 * * 1'   },
  { path: '/api/cron/capacity-alerts',         schedule: '0 * * * *'   },
  { path: '/api/cron/artist-earnings',         schedule: '0 9 1 * *'   },
  { path: '/api/cron?job=audit-log-rotate',   schedule: '0 4 * * 1'   },

  // Backup verification — 5am daily
  { path: '/api/cron/backup-verify',             schedule: '0 5 * * *'   },

  // Additional daily jobs
  { path: '/api/cron?job=close-stale-bookings',  schedule: '0 1 * * *'   },
  { path: '/api/cron?job=artist-onboarding',     schedule: '0 11 * * *'  },
  { path: '/api/cron?job=show-payouts',          schedule: '0 13 * * *'  },
  { path: '/api/cron?job=ad-settlement',         schedule: '0 13 * * *'  },
  { path: '/api/cron?job=stripe-connect-health', schedule: '0 */6 * * *' },

  // Operator tools
  { path: '/api/cron/daily-ops',     schedule: '0 7 * * *'   },  // daily ops report
  { path: '/api/cron/anomaly-check', schedule: '0 * * * *'   },  // hourly anomaly check
  { path: '/api/cron/dmca-enforce',  schedule: '30 3 * * *'  },  // DMCA enforcement at 3:30am
  { path: '/api/cron/social-digest', schedule: '30 8 * * 1'  },  // social digest Monday 8:30am

  // New feature crons
  { path: '/api/cron/nearby-show-notify', schedule: '0 9 * * *'  },  // daily nearby show notifications at 9am
  { path: '/api/cron/publish-scheduled',  schedule: '*/15 * * * *' },  // publish scheduled releases every 15min
  { path: '/api/cron/rsvp-reminders',     schedule: '0 * * * *'   },  // RSVP reminders every hour
  { path: '/api/cron/post-show-recap',    schedule: '0 16 * * *'  },  // morning-after recap for attendees at 4pm UTC
];

async function heartbeat(env: Env): Promise<void> {
  if (!env.HEARTBEAT_URL) return;
  try {
    const response = await fetch(env.HEARTBEAT_URL, {
      method: 'POST',
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      console.error(`[cron] heartbeat returned ${response.status}`);
    }
  } catch (err) {
    // Never let the watchdog break the thing it watches.
    console.error('[cron] heartbeat failed:', err);
  }
}

/** Report a job outcome so the app can track consecutive failures and alert. */
async function reportOutcome(env: Env, path: string, outcome: { ok: true } | { status: number }): Promise<void> {
  try {
    await fetch(`${env.APP_BASE_URL}/api/cron/report-failure`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.CRON_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path, ...outcome }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    console.error(`[cron] outcome report for ${path} failed:`, err);
  }
}

/**
 * Validate the live custom domain from Cloudflare's own network. GitHub-hosted
 * runners are occasionally blocked by Bot Fight Mode before their requests
 * reach the app; this authenticated relay preserves the post-deploy check
 * without adding a public WAF bypass.
 */
async function productionSmoke(env: Env): Promise<Response> {
  const pageChecks = await Promise.all(
    PRODUCTION_SMOKE_PATHS.map(async (path) => {
      try {
        const response = await fetch(`${env.APP_BASE_URL}${path}`, {
          headers: { Accept: 'text/html,application/xhtml+xml' },
          redirect: 'follow',
          signal: AbortSignal.timeout(20_000),
        });
        return { path, status: response.status, ok: response.status === 200 };
      } catch {
        return { path, status: 0, ok: false };
      }
    }),
  );

  let health: {
    status: number;
    ok: boolean;
    databaseOk: boolean;
    launchReady: boolean;
    blockers: unknown[];
  };
  try {
    const response = await fetch(`${env.APP_BASE_URL}/api/health`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${env.CRON_SECRET}`,
      },
      signal: AbortSignal.timeout(20_000),
    });
    const payload = await response.json() as {
      status?: string;
      database?: { ok?: boolean };
      launchReadiness?: { ready?: boolean; blockers?: unknown[] };
    };
    health = {
      status: response.status,
      ok: response.status === 200 && payload.status === 'ok',
      databaseOk: payload.database?.ok === true,
      launchReady: payload.launchReadiness?.ready === true,
      blockers: payload.launchReadiness?.blockers ?? [],
    };
  } catch {
    health = { status: 0, ok: false, databaseOk: false, launchReady: false, blockers: [] };
  }

  const ok = pageChecks.every((check) => check.ok)
    && health.ok
    && health.databaseOk
    && health.launchReady;
  return Response.json(
    { ok, checks: [...pageChecks, { path: '/api/health', ...health }] },
    {
      status: ok ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}

/**
 * Constant-time bearer check for the smoke endpoint. Exported for the test;
 * deliberately not imported from `src/` — this worker is bundled on its own.
 */
export function isSmokeRequestAuthorized(header: string | null, secret: string | undefined): boolean {
  if (!secret || !header) return false;
  const expected = new TextEncoder().encode(`Bearer ${secret}`);
  const actual = new TextEncoder().encode(header);
  if (expected.byteLength !== actual.byteLength) return false;
  let diff = 0;
  for (let i = 0; i < expected.byteLength; i += 1) diff |= expected[i] ^ actual[i];
  return diff === 0;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== '/smoke') return new Response('Not found', { status: 404 });
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } });
    }
    /* Fails closed with no secret and compares in constant time. The old
       `!==` accepted the literal "Bearer undefined" when CRON_SECRET was unset
       and leaked the compare's length through timing (security sweep,
       2026-09-02). */
    if (!isSmokeRequestAuthorized(request.headers.get('Authorization'), env.CRON_SECRET)) {
      return new Response('Unauthorized', { status: 401 });
    }
    return productionSmoke(env);
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const matched = JOBS.filter((job) => job.schedule === event.cron);

    if (matched.length === 0) {
      console.warn(`[cron] No job matched schedule: ${event.cron}`);
      return;
    }

    const outcomes = await Promise.all(
      matched.map(async (job) => {
        const url = `${env.APP_BASE_URL}${job.path}`;
        console.log('[cron] Firing:', job.path, 'at', new Date().toISOString());
        try {
          const res = await fetch(url, {
            method: 'GET',
            headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
            signal: AbortSignal.timeout(55_000),
          });
          if (!res.ok) {
            const body = await res.text().catch(() => '');
            console.error(`[cron] ${job.path} → ${res.status}: ${body}`);
            ctx.waitUntil(reportOutcome(env, job.path, { status: res.status }));
            return false;
          } else {
            console.log(`[cron] ${job.path} → ${res.status}`);
            ctx.waitUntil(reportOutcome(env, job.path, { ok: true }));
            return true;
          }
        } catch (err) {
          console.error(`[cron] ${job.path} fetch failed:`, err);
          ctx.waitUntil(reportOutcome(env, job.path, { status: 0 }));
          return false;
        }
      })
    );

    // A dead-man's-switch ping means the entire scheduled batch completed.
    // Per-job outcomes still identify which route failed.
    if (outcomes.every(Boolean)) {
      ctx.waitUntil(heartbeat(env));
    } else {
      console.error(`[cron] ${outcomes.filter((ok) => !ok).length}/${outcomes.length} jobs failed; heartbeat suppressed`);
    }
  },
};

import { kvGet, kvPut } from '@/lib/kv';

const WEEKLY_TTL = 8 * 24 * 60 * 60;
const DAILY_TTL  = 2 * 24 * 60 * 60;

export async function pingCronAlive(jobName: string, ttlSeconds = DAILY_TTL): Promise<void> {
  try {
    await kvPut(`cron-alive:${jobName}`, Date.now(), { ex: ttlSeconds });
  } catch { /* KV unavailable */ }
}

export async function checkCronHealth(): Promise<{ stale: string[]; unknown: string[] }> {
  const jobs = [
    'digest', 'show-reminders', 'db-health', 'new-to-scene', 'workbench-digest',
    'held-track-notice',
    'notification-jobs',
    'onboarding', 'feature-shows', 'stripe-connect-health',
    'artist-onboarding', 'show-payouts', 'ad-settlement', 'close-stale-bookings',
    'stripe-reconcile',
    'weekly-picks', 'follow-digest', 'audit-log-rotate',
    /* Not cron jobs: the two GitHub workflows that write their own key when a
       run PASSES (nightly.yml, restore-drill.yml). A workflow that only goes
       red when it runs says nothing when it never runs, so its absence has to
       be measured from here — two days without a key is the alert. */
    'nightly-walk', 'restore-drill',
  ];
  /* THE TRY USED TO WRAP THE WHOLE LOOP, AND THAT READ AS ALL-CLEAR (2026-09-10).
     A throw from `kvGet` on job n abandoned n+1…N and returned whatever had
     been collected so far — on the FIRST job, an empty `stale`, which the
     health-check cron reads as "every job ran" and `/api/health` publishes as
     an all-clear. That is the one direction this instrument exists to prevent:
     it cannot tell a silent job from an unreadable store, so it must not
     answer as though it can. `admin-routine-data.ts` already models the third
     state; this collapsed it into health. Unknown is now its own list and the
     caller alerts on it. */
  const stale: string[] = [];
  const unknown: string[] = [];
  for (const job of jobs) {
    try {
      const last = await kvGet<number>(`cron-alive:${job}`);
      if (!last) stale.push(job);
    } catch {
      unknown.push(job);
    }
  }
  return { stale, unknown };
}

export { WEEKLY_TTL, DAILY_TTL };

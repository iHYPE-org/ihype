import { kvGet, kvPut } from '@/lib/kv';

const WEEKLY_TTL = 8 * 24 * 60 * 60;
const DAILY_TTL  = 2 * 24 * 60 * 60;

export async function pingCronAlive(jobName: string, ttlSeconds = DAILY_TTL): Promise<void> {
  try {
    await kvPut(`cron-alive:${jobName}`, Date.now(), { ex: ttlSeconds });
  } catch { /* KV unavailable */ }
}

export async function checkCronHealth(): Promise<{ stale: string[] }> {
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
  const stale: string[] = [];
  try {
    for (const job of jobs) {
      const last = await kvGet<number>(`cron-alive:${job}`);
      if (!last) stale.push(job);
    }
  } catch { /* KV unavailable */ }
  return { stale };
}

export { WEEKLY_TTL, DAILY_TTL };

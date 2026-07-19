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
    'digest', 'show-reminders', 'db-health', 'new-to-scene',
    'onboarding', 'feature-shows', 'stripe-connect-health',
    'artist-onboarding', 'show-payouts', 'ad-settlement', 'close-stale-bookings',
    'weekly-picks', 'follow-digest', 'audit-log-rotate',
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

import { kv } from '@vercel/kv';

export async function pingCronAlive(jobName: string): Promise<void> {
  try {
    await kv.set(`cron-alive:${jobName}`, Date.now(), { ex: 2 * 24 * 60 * 60 }); // 48h expiry
  } catch { /* KV unavailable */ }
}

export async function checkCronHealth(): Promise<{ stale: string[] }> {
  const jobs = ['digest', 'show-reminders', 'db-health', 'weekly-picks', 'new-to-scene'];
  const stale: string[] = [];
  try {
    for (const job of jobs) {
      const last = await kv.get<number>(`cron-alive:${job}`);
      if (!last) stale.push(job);
    }
  } catch { /* KV unavailable */ }
  return { stale };
}

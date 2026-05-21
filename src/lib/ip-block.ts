import { kvGet, kvIncr, kvPut } from '@/lib/kv';

export async function isBlocked(ip: string): Promise<boolean> {
  try {
    const blocked = await kvGet<number>(`ip-block:${ip}`);
    return blocked !== null;
  } catch { return false; }
}

export async function blockIp(ip: string, durationMs = 24 * 60 * 60 * 1000): Promise<void> {
  try {
    await kvPut(`ip-block:${ip}`, 1, { ex: Math.ceil(durationMs / 1000) });
  } catch { /* KV unavailable */ }
}

export async function recordLimitHit(ip: string): Promise<void> {
  try {
    const key = `limit-hits:${ip}`;
    const hits = await kvIncr(key, 3600);
    if (hits >= 10) {
      await blockIp(ip);
    }
  } catch { /* KV unavailable */ }
}

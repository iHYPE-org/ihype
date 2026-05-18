import { kv } from '@vercel/kv';

export async function isBlocked(ip: string): Promise<boolean> {
  try {
    const blocked = await kv.get<number>(`ip-block:${ip}`);
    return blocked !== null;
  } catch { return false; }
}

export async function blockIp(ip: string, durationMs = 24 * 60 * 60 * 1000): Promise<void> {
  try {
    await kv.set(`ip-block:${ip}`, 1, { px: durationMs });
  } catch { /* KV unavailable */ }
}

export async function recordLimitHit(ip: string): Promise<void> {
  try {
    const key = `limit-hits:${ip}`;
    const hits = await kv.incr(key);
    await kv.expire(key, 3600); // 1 hour window
    if (hits >= 10) {
      await blockIp(ip);
    }
  } catch { /* KV unavailable */ }
}

import { describe, expect, it, vi } from 'vitest';

const showFindMany = vi.fn();
vi.mock('@/lib/cron-auth', () => ({ isCronRequestAuthorized: () => true }));
vi.mock('@/lib/notify', () => ({ sendPushToAllDevices: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/logger', () => ({ log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/db', () => ({
  db: {
    show: { findMany: (...a: unknown[]) => showFindMany(...a), update: vi.fn().mockResolvedValue({}) },
    profileHypeEvent: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

import { NextRequest } from 'next/server';
import { GET } from './route';

describe('GET /api/cron/capacity-alerts', () => {
  it('answers 500 when the work list cannot be read — the dispatcher must count the job failed, not quiet', async () => {
    showFindMany.mockImplementation(() => Promise.reject(new Error('db down')));
    const res = await GET(new NextRequest('http://ihype.test/api/cron/capacity-alerts'));
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toMatchObject({ ok: false, error: 'READ_FAILED' });
  });

  it('answers a quiet run only when the read landed and found nothing', async () => {
    showFindMany.mockImplementation(() => Promise.resolve([]));
    const res = await GET(new NextRequest('http://ihype.test/api/cron/capacity-alerts'));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ ok: true, notified: 0, shows: 0 });
  });
});

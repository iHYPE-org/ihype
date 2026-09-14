import { describe, expect, it, vi } from 'vitest';

const profileFindMany = vi.fn();
vi.mock('@/lib/cron-auth', () => ({ isCronRequestAuthorized: () => true }));
vi.mock('@/lib/artist-earnings-email', () => ({ sendArtistEarningsSummaryEmail: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/logger', () => ({ log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/db', () => ({
  db: {
    profile: { findMany: (...a: unknown[]) => profileFindMany(...a) },
    profileHypeEvent: { count: vi.fn().mockResolvedValue(0) },
    user: { update: vi.fn().mockResolvedValue({}) },
  },
}));

import { NextRequest } from 'next/server';
import { GET } from './route';

describe('GET /api/cron/artist-earnings', () => {
  it('answers 500 when the profiles read fails — never `sent: 0` over a read that did not run', async () => {
    profileFindMany.mockImplementation(() => Promise.reject(new Error('db down')));
    const res = await GET(new NextRequest('http://ihype.test/api/cron/artist-earnings'));
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toMatchObject({ ok: false, error: 'READ_FAILED' });
  });

  it('answers a quiet run only when the read landed and nobody is owed a summary', async () => {
    profileFindMany.mockImplementation(() => Promise.resolve([]));
    const res = await GET(new NextRequest('http://ihype.test/api/cron/artist-earnings'));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ ok: true, sent: 0 });
  });
});

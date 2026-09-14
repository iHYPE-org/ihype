import { describe, expect, it, vi } from 'vitest';

const assetFindMany = vi.fn();
vi.mock('@/lib/auth', () => ({ auth: vi.fn().mockResolvedValue({ user: { id: 'fan1' } }) }));
vi.mock('@/lib/db', () => ({
  db: {
    profile: { findFirst: vi.fn().mockResolvedValue(null) },
    follow: { findMany: vi.fn().mockResolvedValue([]) },
    user: { findUnique: vi.fn().mockResolvedValue(null) },
    artistMediaAsset: { findMany: (...a: unknown[]) => assetFindMany(...a) },
    seed: { groupBy: vi.fn().mockResolvedValue([]) },
  },
}));

import { NextRequest } from 'next/server';
import { GET } from './route';

describe('GET /api/charts', () => {

  it('answers 503 when the candidates read fails — never `rows: [], reason: no-tracks`', async () => {
    assetFindMany.mockImplementation(() => Promise.reject(new Error('db down')));
    const res = await GET(new NextRequest('http://ihype.test/api/charts?dataset=area&scope=global'));
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({ code: 'READ_UNAVAILABLE' });
  });

  it('answers no-tracks when the read lands and finds nothing', async () => {
    assetFindMany.mockResolvedValue([]);
    const res = await GET(new NextRequest('http://ihype.test/api/charts?dataset=area&scope=global'));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ rows: [], reason: 'no-tracks' });
  });
});

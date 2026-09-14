import { beforeEach, describe, expect, it, vi } from 'vitest';

const assetFindMany = vi.fn();
const profileFindFirst = vi.fn();
vi.mock('@/lib/auth', () => ({ auth: vi.fn().mockResolvedValue({ user: { id: 'fan1' } }) }));
vi.mock('@/lib/logger', () => ({ log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/request-location', () => ({ detectRequestLocation: vi.fn().mockResolvedValue(null) }));
vi.mock('@/lib/recommendations', () => ({
  getRecommendations: vi.fn().mockResolvedValue({
    meta: { ready: true, viewerSignals: {} },
    profiles: [{ id: 'artist1', name: 'A', slug: 'a', reasons: [], reason: 'You follow them' }],
  }),
}));
vi.mock('@/lib/db', () => ({
  db: {
    profile: { findFirst: (...a: unknown[]) => profileFindFirst(...a) },
    artistMediaAsset: { findMany: (...a: unknown[]) => assetFindMany(...a) },
  },
}));

import { GET } from './route';

describe('GET /api/recommend', () => {
  beforeEach(() => {
    profileFindFirst.mockClear().mockResolvedValue(null);
    assetFindMany.mockClear();
  });

  it('answers 503 when the tracks read fails — never `ready: true, tracks: []`', async () => {
    assetFindMany.mockImplementation(() => Promise.reject(new Error('db down')));
    const res = await GET();
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({ code: 'READ_UNAVAILABLE' });
  });
});

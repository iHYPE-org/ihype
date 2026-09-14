import { beforeEach, describe, expect, it, vi } from 'vitest';

const profileFindFirst = vi.fn();
const profileFindMany = vi.fn();
const followFindMany = vi.fn();
vi.mock('@/lib/auth', () => ({ auth: vi.fn().mockResolvedValue({ user: { id: 'fan1' } }) }));
vi.mock('@/lib/request-location', () => ({ detectRequestLocation: vi.fn().mockResolvedValue(null) }));
vi.mock('@/lib/db', () => ({
  db: {
    profile: { findFirst: (...a: unknown[]) => profileFindFirst(...a), findMany: (...a: unknown[]) => profileFindMany(...a) },
    follow: { findMany: (...a: unknown[]) => followFindMany(...a) },
  },
}));

import { GET } from './route';

describe('GET /api/venue-requests/venues', () => {
  beforeEach(() => {
    profileFindFirst.mockClear().mockResolvedValue({ city: 'Portland', stateRegion: 'ME', latitude: 43.66, longitude: -70.26 });
    profileFindMany.mockClear().mockResolvedValue([]);
    followFindMany.mockClear().mockResolvedValue([]);
  });

  it('answers 503 when a group read fails — never three empty lists', async () => {
    followFindMany.mockImplementation(() => Promise.reject(new Error('db down')));
    const res = await GET(new Request('http://ihype.test/api/venue-requests/venues?artistProfileId=a1'));
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({ code: 'READ_UNAVAILABLE' });
  });

  it('answers the three groups when every read lands', async () => {
    const res = await GET(new Request('http://ihype.test/api/venue-requests/venues?artistProfileId=a1&q=ba'));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ loved: [], nearby: [], matches: [] });
  });
});

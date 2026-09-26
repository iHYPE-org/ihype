import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
const profileFindFirst = vi.fn();
const mediaCount = vi.fn();
const showCount = vi.fn();
vi.mock('@/lib/db', () => ({
  db: {
    profile: { findFirst: (...a: unknown[]) => profileFindFirst(...a) },
    artistMediaAsset: { count: (...a: unknown[]) => mediaCount(...a) },
    show: { count: (...a: unknown[]) => showCount(...a) },
  },
  withDbRetry: (fn: () => unknown) => fn(),
}));

import { auth } from '@/lib/auth';
import { GET } from './route';

const authMock = auth as unknown as ReturnType<typeof vi.fn>;

const artist = {
  id: 'p1', slug: 'the-band', name: 'The Band', type: 'ARTIST',
  avatarImage: '/cdn/profile/a.png', logoImage: null, bio: 'Loud.',
  addressLine1: null, city: null, capacity: null,
  stripeConnectOnboarded: false, onboardedAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({ user: { id: 'u1' } });
  mediaCount.mockResolvedValue(3);
  showCount.mockResolvedValue(0);
});

describe('GET /api/me/getting-started', () => {
  it('refuses a signed-out caller', async () => {
    authMock.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
  });

  it('reads the caller’s own first creator profile, never one named by the request', async () => {
    profileFindFirst.mockResolvedValue(artist);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    expect(profileFindFirst.mock.calls[0][0].where).toEqual({ ownerId: 'u1', type: { in: ['ARTIST', 'VENUE'] } });
    const body = await res.json();
    expect(body.guide.role).toBe('ARTIST');
    expect(body.guide.steps.map((s: { done: boolean }) => s.done)).toEqual([true, true, false, false]);
  });

  it('gives a member with no creator profile the fan guide', async () => {
    profileFindFirst.mockResolvedValue(null);
    const body = await (await GET()).json();
    expect(body.guide.role).toBe('FAN');
  });

  it('answers 503 when the profile read fails, never a fan guide for an artist', async () => {
    profileFindFirst.mockRejectedValue(new Error('down'));
    expect((await GET()).status).toBe(503);
  });

  it('leaves a step unticked when only its count fails', async () => {
    profileFindFirst.mockResolvedValue(artist);
    mediaCount.mockRejectedValue(new Error('down'));
    const body = await (await GET()).json();
    expect(body.guide.steps[1].done).toBe(false);
  });
});

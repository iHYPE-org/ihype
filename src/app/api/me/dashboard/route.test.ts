import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/logger', () => ({ log: { error: vi.fn() } }));
vi.mock('@/lib/db', () => {
  const models = new Map<string, Record<string, ReturnType<typeof vi.fn>>>();
  const makeModel = () => ({
    findUnique: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
  });
  const db = new Proxy({} as Record<string, unknown>, {
    get(_target, property: string) {
      if (!models.has(property)) models.set(property, makeModel());
      return models.get(property);
    },
  });
  return { db };
});

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { GET } from './route';

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockDb = db as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>;

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { id: 'fan-1' } });
  mockDb.user.findUnique.mockResolvedValue({ role: 'FAN' });
  mockDb.profile.findMany.mockResolvedValue([]);
  mockDb.advertiserAccount.findUnique.mockResolvedValue(null);
  mockDb.notification.findMany.mockResolvedValue([]);
  mockDb.show.findMany.mockResolvedValue([]);
  mockDb.follow.count.mockResolvedValue(2);
  mockDb.profileHypeEvent.count.mockResolvedValue(3);
  mockDb.ticketOrder.count.mockResolvedValue(1);
  mockDb.artistMediaAsset.count.mockResolvedValue(0);
});

describe('GET /api/me/dashboard', () => {
  it('requires an authenticated user', async () => {
    mockAuth.mockResolvedValue(null);
    const response = await GET(new Request('https://ihype.org/api/me/dashboard'));
    expect(response.status).toBe(401);
  });

  it('does not expose a creator dashboard role the user does not own', async () => {
    const response = await GET(new Request('https://ihype.org/api/me/dashboard?role=artist'));
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.build.title).toBe('Your listening profile');
    expect(payload.nextAction.href).toBe('/app/music/discover');
    expect(payload.insights).toContain('3 artists or venues currently carry your HYPE signal');
  });

  it('returns creator-owned workspace data and only public recommendations', async () => {
    mockDb.user.findUnique.mockResolvedValue({ role: 'ARTIST' });
    mockDb.profile.findMany
      .mockResolvedValueOnce([{ id: 'artist-1', type: 'ARTIST', name: 'Real Artist', slug: 'real-artist', headline: 'Local', bio: 'Bio', heroImage: '/hero.jpg', avatarImage: null, genres: ['Rock'], hypeCount: 12, onboardedAt: new Date() }])
      .mockResolvedValueOnce([{ id: 'venue-1', type: 'VENUE', name: 'Real Room', slug: 'real-room', city: 'Detroit', stateRegion: 'MI', genres: ['Rock'], hypeCount: 48 }]);
    mockDb.artistMediaAsset.count.mockResolvedValue(2);

    const response = await GET(new Request('https://ihype.org/api/me/dashboard?role=artist'));
    const payload = await response.json();
    expect(payload.build.title).toBe('Real Artist workspace · 100% ready');
    expect(payload.recommendations).toEqual([expect.objectContaining({ title: 'Real Room', href: '/venues/real-room' })]);
    expect(mockDb.profile.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: expect.objectContaining({ discoverable: true, ownerId: { not: 'fan-1' } }) }));
  });
});

/**
 * The recommendation engine scores every act a PERSONAL signal names, not only
 * the most-hyped 400 (2026-09-24, DESIGN_SYNC row 513).
 *
 * Until that date `getRecommendations` built its collaborative, comparable,
 * seed and fan-demand maps and then scored only the popularity pool, so an act
 * that fans like the viewer hyped was computed and dropped unless it was
 * already one of the 400 most-hyped profiles on the platform. The browser suite
 * found it: its Recommended-tab test names the fixture's neighbour, and on a
 * scratch database holding many earlier runs' artists the neighbour fell out of
 * the pool and the tab offered no play control for it.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, unknown>;
const profile = (id: string, hypeCount: number): Row => ({
  id, slug: id, hexId: `0x${id}`, type: 'ARTIST', name: `Act ${id}`,
  headline: null, bio: null, city: null, stateRegion: null, country: null,
  genres: ['indie'], hypeCount, verified: false, avatarImage: null,
  createdAt: new Date('2026-09-01T00:00:00Z'),
});

const state = { popular: [] as Row[], signalQueries: [] as unknown[] };

vi.mock('@/lib/db', () => ({
  db: {
    profileHypeEvent: {
      findMany: vi.fn(async (args: { where: { userId?: unknown } }) => {
        // The viewer's own hypes: they know act K.
        if (args.where.userId === 'cold') return [];
        if (args.where.userId === 'viewer') {
          return [{ profileId: 'K', profile: { name: 'Known', slug: 'known', genres: ['indie'], stateRegion: null, country: null } }];
        }
        // Fans who also hyped K: one neighbour.
        return [{ userId: 'neighbour-fan' }];
      }),
      groupBy: vi.fn(async (args: { where: { userId?: unknown; createdAt?: unknown } }) => {
        // What the neighbour hyped besides K: the niche act N.
        if (args.where.userId) return [{ profileId: 'N', _count: { _all: 1 } }];
        return [];
      }),
    },
    seed: { findMany: vi.fn(async () => []) },
    follow: { findMany: vi.fn(async () => []) },
    artistMediaAsset: { findMany: vi.fn(async () => []) },
    profile: {
      findMany: vi.fn(async (args: { where: Row; orderBy?: unknown }) => {
        if ('genres' in args.where) return []; // comparable-artist seed list
        const byId = (args.where.id as { in?: string[] } | undefined)?.in;
        if (byId) {
          state.signalQueries.push(byId);
          return byId.includes('N') ? [profile('N', 0)] : [];
        }
        return state.popular;
      }),
    },
  },
}));

vi.mock('@/lib/request-signals', () => ({
  loadRequestSignals: vi.fn(async () => ({ requestedArtistIds: [], requestedVenueIds: [], wantedAt: [] })),
  loadCoRequesterIds: vi.fn(async () => []),
}));

vi.mock('@/lib/runtime-flags', () => ({ getDemoOwnerExclusion: () => ({}) }));

describe('getRecommendations candidate pool', () => {
  beforeEach(() => {
    state.signalQueries = [];
    // A popular pool that does NOT contain the neighbour's act.
    state.popular = Array.from({ length: 5 }, (_, i) => profile(`P${i}`, 500 - i));
  });

  it('recommends an act fans like the viewer hyped, even when it is outside the popularity pool', async () => {
    const { getRecommendations } = await import('@/lib/recommendations');
    const result = await getRecommendations('viewer', null, { type: 'ARTIST', limit: 25 });
    const ids = result.profiles.map((p) => p.id);
    expect(ids).toContain('N');
    expect(state.signalQueries).toEqual([['N']]);
    const n = result.profiles.find((p) => p.id === 'N');
    expect(n?._scores.collab).toBe(1);
  });

  it('never recommends an act the viewer already knows, from either list', async () => {
    state.popular = [profile('K', 900), ...state.popular];
    const { getRecommendations } = await import('@/lib/recommendations');
    const result = await getRecommendations('viewer', null, { type: 'ARTIST', limit: 25 });
    expect(result.profiles.map((p) => p.id)).not.toContain('K');
  });

  it('answers a viewer with no taste signal without reading the candidate pool', async () => {
    const { db } = await import('@/lib/db');
    const findMany = db.profile.findMany as unknown as { mock: { calls: unknown[][] } };
    const before = findMany.mock.calls.length;
    const { getRecommendations } = await import('@/lib/recommendations');
    const result = await getRecommendations('cold', null, { type: 'ARTIST', limit: 25 });
    expect(result.meta.ready).toBe(false);
    expect(result.profiles).toEqual([]);
    expect(findMany.mock.calls.length).toBe(before);
  });

  it('does not score an act twice when it is in both lists', async () => {
    state.popular = [profile('N', 50), ...state.popular];
    const { getRecommendations } = await import('@/lib/recommendations');
    const result = await getRecommendations('viewer', null, { type: 'ARTIST', limit: 25 });
    expect(result.profiles.filter((p) => p.id === 'N')).toHaveLength(1);
  });
});

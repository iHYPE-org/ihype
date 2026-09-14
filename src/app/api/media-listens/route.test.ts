import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The listen route's first test, and the reason it exists: the player posts a
 * track's HEXID as `mediaId` (src/lib/mmm-play.ts `toQueue`) while this route
 * looked the row up by `id`, so every completion a real member's browser ever
 * sent answered 404 and nothing was recorded — no listen, no recents rail, no
 * TRACK_COMPLETED reward. The acceptance walk never saw it because its items
 * post the row id. And the row was STORED under the row id while every
 * counter reads by hexId, so even those listens were counted by nothing a
 * member reads. DESIGN_SYNC row 436.
 */

vi.mock('@/lib/auth', () => ({ auth: vi.fn().mockResolvedValue({ user: { id: 'fan_1' } }) }));
vi.mock('@/lib/rate-limit', () => ({
  consumeRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  rateLimitHeaders: () => ({}),
  rateLimitKey: (...parts: unknown[]) => parts.join(':'),
}));
vi.mock('@/lib/logger', () => ({ log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
const awardHype = vi.fn().mockResolvedValue({ applied: true, entry: { amount: 1, balanceAfter: 1 } });
vi.mock('@/lib/hype-ledger', () => ({ awardHype: (...args: unknown[]) => awardHype(...args) }));

const findFirst = vi.fn();
const assetFindMany = vi.fn();
const upsert = vi.fn().mockResolvedValue({});
const listenFindMany = vi.fn();
vi.mock('@/lib/db', () => ({
  db: {
    artistMediaAsset: {
      findFirst: (...args: unknown[]) => findFirst(...args),
      findMany: (...args: unknown[]) => assetFindMany(...args),
    },
    mediaListen: {
      upsert: (...args: unknown[]) => upsert(...args),
      findMany: (...args: unknown[]) => listenFindMany(...args),
    },
  },
}));

import { GET, POST } from './route';

const HEX = '0x0da03cb4443f21ab44375fc6a0467325';
const ROW = {
  id: 'cmu0row000000000000000000',
  hexId: HEX,
  title: 'Signal',
  storageUrl: 'https://ihype.org/cdn/artist-media/p/t.m4a',
  profile: { name: 'E2E Station Artist', slug: 'e2e-station-artist', discoverable: true },
};
function post(mediaId: string) {
  return POST(new Request('http://localhost/api/media-listens', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mediaId, title: 'Signal', mediaUrl: ROW.storageUrl, artistName: ROW.profile.name, artistProfileSlug: ROW.profile.slug }),
  }));
}

describe('a completion is recorded whether the track is named by row id or by hexId', () => {
  beforeEach(() => { findFirst.mockReset(); upsert.mockClear(); awardHype.mockClear(); findFirst.mockResolvedValue(ROW); });

  it('resolves the row by EITHER name — the player sends the hexId', async () => {
    const response = await post(HEX);
    expect(response.status).toBe(200);
    const where = findFirst.mock.calls[0]?.[0]?.where;
    expect(where.AND[0].OR).toEqual([{ id: HEX }, { hexId: HEX }]);
    // The release gate survives beside it: a spread would have let one OR
    // replace the other, and a held or scheduled track would have counted.
    expect(where.AND[1]).toMatchObject({ isPublished: true });
  });

  it('stores the listen under the HEXID, whichever name arrived — that is the name every counter reads', async () => {
    await post(ROW.id);
    const args = upsert.mock.calls[0]?.[0];
    expect(args.where.userId_mediaId).toEqual({ userId: 'fan_1', mediaId: HEX });
    expect(args.create.mediaId).toBe(HEX);
  });

  it('keeps the HYPE ledger key on the ROW id: renaming it would reward a track already rewarded', async () => {
    await post(HEX);
    expect(awardHype.mock.calls[0]?.[0]).toMatchObject({ targetId: ROW.id, idempotencyKey: `track-completed:fan_1:${ROW.id}` });
  });

  it('takes a RELATIVE mediaUrl — the deck plays `/api/media/<hexId>` and a playlist saved from it stores that path', async () => {
    const response = await POST(new Request('http://localhost/api/media-listens', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mediaId: HEX, title: 'Signal', mediaUrl: `/api/media/${HEX}`, artistName: ROW.profile.name }),
    }));
    expect(response.status).toBe(200);
    // And the stored copy is the asset's own url, not the caller's path.
    expect(upsert.mock.calls[0]?.[0]?.create.mediaUrl).toBe(ROW.storageUrl);
  });

  it('still answers 404 for a track that is not published, by either name', async () => {
    findFirst.mockResolvedValue(null);
    expect((await post(HEX)).status).toBe(404);
    expect((await post(ROW.id)).status).toBe(404);
    expect(upsert).not.toHaveBeenCalled();
  });
});

describe('the recents rail reads the stored hexId back', () => {
  it('hydrates the cover by hexId and hands the rail the hexId as both id and hexId', async () => {
    listenFindMany.mockResolvedValue([
      { mediaId: HEX, title: 'Signal', mediaUrl: ROW.storageUrl, artistName: ROW.profile.name, artistProfileSlug: ROW.profile.slug, completedAt: new Date() },
    ]);
    assetFindMany.mockResolvedValue([{ hexId: HEX, artworkUrl: 'https://ihype.org/cdn/artist-media/p/cover.png' }]);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(assetFindMany.mock.calls[0]?.[0]?.where).toEqual({ hexId: { in: [HEX] } });
    const { recents } = await response.json();
    expect(recents).toEqual([expect.objectContaining({ id: HEX, hexId: HEX, artworkUrl: 'https://ihype.org/cdn/artist-media/p/cover.png' })]);
  });
});

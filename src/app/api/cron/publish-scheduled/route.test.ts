import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/cron-auth', () => ({ isCronRequestAuthorized: () => true }));

const sendPushToAllDevices = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/notify', () => ({
  sendPushToAllDevices: (...a: unknown[]) => sendPushToAllDevices(...a),
}));

const assetFindMany = vi.fn();
const assetUpdateMany = vi.fn();
const prefFindMany = vi.fn();
vi.mock('@/lib/db', () => ({
  db: {
    artistMediaAsset: {
      findMany: (...a: unknown[]) => assetFindMany(...a),
      updateMany: (...a: unknown[]) => assetUpdateMany(...a),
    },
    notificationPreference: { findMany: (...a: unknown[]) => prefFindMany(...a) },
  },
}));

import { GET } from './route';

const request = new Request('https://ihype.org/api/cron/publish-scheduled') as never;

function asset(over: Record<string, unknown> = {}) {
  return {
    id: 'a1',
    title: 'Harbour Light',
    profile: { ownerId: 'artist-user', name: 'The Band', slug: 'the-band' },
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  assetFindMany.mockResolvedValue([asset()]);
  assetUpdateMany.mockResolvedValue({ count: 1 });
  prefFindMany.mockResolvedValue([]);
});

describe('a scheduled release goes live and says so, at a URL that exists', () => {
  /* THE LINK WAS BUILT OUT OF A USER ID (2026-09-10). The notice pointed at
     `/artists/${profile.ownerId}` — a User id in a path keyed on a profile
     SLUG — so every "your track is live" notification an artist had ever
     received landed on a 404, and `slug` was not even selected. */
  it('links to the artist page by slug, in the shell', async () => {
    await GET(request);
    expect(sendPushToAllDevices).toHaveBeenCalledWith(
      'artist-user',
      expect.objectContaining({ url: '/app/artists/the-band' }),
    );
  });

  it('selects the slug it links with', async () => {
    await GET(request);
    const select = (assetFindMany.mock.calls[0][0] as { include: { profile: { select: Record<string, boolean> } } })
      .include.profile.select;
    expect(select.slug).toBe(true);
  });

  /* `crateUploads` is the Settings toggle named for this notice and nothing
     read it, so an artist who switched "Track uploads" off kept getting them. */
  it('stays quiet for an artist who switched the notice off', async () => {
    prefFindMany.mockResolvedValue([{ userId: 'artist-user' }]);
    const res = await GET(request);
    expect(res.status).toBe(200);
    expect(sendPushToAllDevices).not.toHaveBeenCalled();
  });

  it('publishes the release even when the notice is muted', async () => {
    prefFindMany.mockResolvedValue([{ userId: 'artist-user' }]);
    await GET(request);
    expect(assetUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isPublished: true } }),
    );
  });

  /* An unreadable preference must SEND: the artist scheduled this release and
     is waiting to hear it went out, so a failed read may not silently swallow
     the one notice that says it did. */
  it('still notifies when the preference read fails', async () => {
    prefFindMany.mockRejectedValue(new Error('database is down'));
    await GET(request);
    expect(sendPushToAllDevices).toHaveBeenCalled();
  });

  it('mutes only the artist who asked, not everyone in the batch', async () => {
    assetFindMany.mockResolvedValue([
      asset(),
      asset({ id: 'a2', title: 'Second Wind', profile: { ownerId: 'other-user', name: 'Someone', slug: 'someone' } }),
    ]);
    prefFindMany.mockResolvedValue([{ userId: 'artist-user' }]);
    await GET(request);
    expect(sendPushToAllDevices).toHaveBeenCalledTimes(1);
    expect(sendPushToAllDevices).toHaveBeenCalledWith('other-user', expect.anything());
  });
});

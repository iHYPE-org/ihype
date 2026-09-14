import { describe, expect, it, vi } from 'vitest';

/* The album's date IS its tracks' release moment, and the two writes are one
   transaction (DESIGN_SYNC row 456). The transaction is driven with a fake
   `tx`, so what is measured is the route's answer when the CASCADE fails: the
   request fails, rather than answering 200 with a dated folder whose tracks
   never received the date. */
const albumUpdate = vi.fn();
const assetUpdateMany = vi.fn();
vi.mock('@/lib/auth', () => ({ auth: vi.fn().mockResolvedValue({ user: { id: 'artist-owner' } }) }));
vi.mock('@/lib/permissions', () => ({ canManageOwnedResource: () => true }));
vi.mock('@/lib/object-storage', () => ({ deleteMediaFile: vi.fn(), isStoredMediaUrl: () => false }));
vi.mock('@/lib/logger', () => ({ log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/db', () => {
  const tx = {
    album: { update: (...a: unknown[]) => albumUpdate(...a) },
    artistMediaAsset: { updateMany: (...a: unknown[]) => assetUpdateMany(...a) },
  };
  return {
    withDbRetry: (fn: () => Promise<unknown>) => fn(),
    db: {
      $transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
      album: {
        findUnique: vi.fn().mockResolvedValue({ id: 'alb1', profileId: 'p1', artworkUrl: null, profile: { ownerId: 'artist-owner' } }),
      },
    },
  };
});

import { PATCH } from './route';

const dated = { id: 'alb1', title: 'Folder', artworkUrl: null, releasedOn: new Date('2030-01-01T00:00:00Z'), sortOrder: 0, _count: { tracks: 3 } };
const patch = (body: Record<string, unknown>) =>
  PATCH(new Request('http://ihype.test/api/albums/alb1', { method: 'PATCH', body: JSON.stringify(body) }), {
    params: Promise.resolve({ albumId: 'alb1' }),
  });

describe('PATCH /api/albums/[albumId]', () => {
  it('dates the folder and schedules every non-held track in the same transaction', async () => {
    albumUpdate.mockImplementation(() => Promise.resolve(dated));
    assetUpdateMany.mockImplementation(() => Promise.resolve({ count: 3 }));
    const res = await patch({ releasedOn: '2030-01-01' });
    expect(res.status).toBe(200);
    expect(assetUpdateMany).toHaveBeenCalledTimes(1);
    expect(assetUpdateMany.mock.calls[0][0]).toMatchObject({
      where: { albumId: 'alb1', NOT: { isPublished: false, publishAt: null } },
      data: { isPublished: false },
    });
  });

  it('fails the request when the cascade fails — never 200 with a date the tracks did not get', async () => {
    albumUpdate.mockImplementation(() => Promise.resolve(dated));
    assetUpdateMany.mockImplementation(() => Promise.reject(new Error('db down')));
    const res = await patch({ releasedOn: '2030-01-01' });
    expect(res.status).toBe(500);
  });

  it('a rename touches no track', async () => {
    albumUpdate.mockImplementation(() => Promise.resolve({ ...dated, title: 'Renamed' }));
    assetUpdateMany.mockClear();
    const res = await patch({ title: 'Renamed' });
    expect(res.status).toBe(200);
    expect(assetUpdateMany).not.toHaveBeenCalled();
  });
});

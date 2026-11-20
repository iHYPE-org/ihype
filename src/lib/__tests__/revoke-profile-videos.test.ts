import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({
  db: { profileVideo: { findMany: vi.fn(), updateMany: vi.fn() } },
  withDbRetry: (fn: () => Promise<unknown>) => fn(),
}));
vi.mock('@/lib/mux-video', () => ({
  muxRequest: vi.fn(),
  MuxApiError: class MuxApiError extends Error {
    constructor(readonly status: number) { super(`Mux status ${status}`); }
  },
}));

import { db } from '@/lib/db';
import { MuxApiError, muxRequest } from '@/lib/mux-video';
import { revokeProfileVideoPlayback, VIDEO_REVOKE_WARNING } from '@/lib/revoke-profile-videos';

const findVideos = db.profileVideo.findMany as unknown as ReturnType<typeof vi.fn>;
const updateVideos = db.profileVideo.updateMany as unknown as ReturnType<typeof vi.fn>;
const provider = muxRequest as unknown as ReturnType<typeof vi.fn>;

const video = {
  id: 'v1', muxAssetId: 'asset-1', muxPlaybackId: 'public-1',
};

describe('profile visibility Mux playback revocation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    findVideos.mockResolvedValue([video]);
    updateVideos.mockResolvedValue({ count: 1 });
    provider.mockResolvedValue({});
  });

  it('revokes the public provider ID and then marks the video private', async () => {
    const result = await revokeProfileVideoPlayback('profile-1');
    expect(result.failed).toBe(0);
    expect(findVideos).toHaveBeenCalledWith({
      where: { profileId: 'profile-1', muxPlaybackId: { not: null } },
      select: { id: true, muxAssetId: true, muxPlaybackId: true },
    });
    expect(provider).toHaveBeenCalledWith('/assets/asset-1/playback-ids/public-1', 'DELETE');
    expect(updateVideos).toHaveBeenCalledWith({
      where: { id: 'v1', muxPlaybackId: 'public-1' },
      data: { muxPlaybackId: null, isPublished: false },
    });
  });

  it('handles Mux already-revoked 404 as successful cleanup', async () => {
    provider.mockRejectedValueOnce(new MuxApiError(404));
    expect(await revokeProfileVideoPlayback('profile-1')).toEqual({ failed: 0 });
    expect(updateVideos).toHaveBeenCalledOnce();
  });

  it('never discards the provider ID if Mux deletion fails', async () => {
    provider.mockRejectedValueOnce(new MuxApiError(503));
    expect(await revokeProfileVideoPlayback('profile-1')).toEqual({ failed: 1 });
    expect(updateVideos).not.toHaveBeenCalled();
    expect(VIDEO_REVOKE_WARNING).toMatch(/video links/);
  });

  it('reports a failed database cleanup so it can be retried', async () => {
    updateVideos.mockRejectedValueOnce(new Error('database unavailable'));
    expect(await revokeProfileVideoPlayback('profile-1')).toEqual({ failed: 1 });
  });

  it('does not access Mux when the profile never published a video', async () => {
    findVideos.mockResolvedValueOnce([]);
    expect(await revokeProfileVideoPlayback('profile-1')).toEqual({ failed: 0 });
    expect(provider).not.toHaveBeenCalled();
  });

  it('does not forget a playback ID when its asset identifier is missing', async () => {
    findVideos.mockResolvedValueOnce([{ ...video, muxAssetId: null }]);
    expect(await revokeProfileVideoPlayback('profile-1')).toEqual({ failed: 1 });
    expect(updateVideos).not.toHaveBeenCalled();
  });
});

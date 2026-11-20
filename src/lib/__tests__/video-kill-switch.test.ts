import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: 'owner-1' } }),
}));
vi.mock('@/lib/db', () => ({
  db: {
    profileVideo: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  },
  withDbRetry: (fn: () => Promise<unknown>) => fn(),
}));
vi.mock('@/lib/permissions', () => ({
  canManageOwnedResource: vi.fn().mockReturnValue(true),
}));
vi.mock('@/lib/rate-limit', () => ({
  consumeRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
}));
vi.mock('@/lib/mux-video', () => ({
  isVideoUploadEnabled: vi.fn().mockReturnValue(false),
  muxRequest: vi.fn().mockResolvedValue({}),
}));
vi.mock('@/lib/delete-hosted-video', () => ({
  deleteHostedProfileVideo: vi.fn().mockResolvedValue(undefined),
}));

import { PATCH, DELETE } from '@/app/api/site-videos/[id]/route';
import { db } from '@/lib/db';
import { isVideoUploadEnabled, muxRequest } from '@/lib/mux-video';
import { deleteHostedProfileVideo } from '@/lib/delete-hosted-video';

const findVideo = db.profileVideo.findUnique as unknown as ReturnType<typeof vi.fn>;
const originalVideo = {
  id: 'video-1', muxUploadId: 'upload-1', muxAssetId: 'asset-1',
  muxPlaybackId: 'playback-1', status: 'READY', isPublished: true,
  archiveKey: null, archiveUploadId: null,
  profile: { ownerId: 'owner-1', type: 'ARTIST', verificationStatus: 'VERIFIED' },
};
const params = { params: Promise.resolve({ id: 'video-1' }) };

describe('video emergency disable switch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isVideoUploadEnabled).mockReturnValue(false);
    findVideo.mockResolvedValue({ ...originalVideo });
  });

  it('allows owners to unpublish a hosted video after uploads are disabled', async () => {
    const response = await PATCH(new Request('https://ihype.org/api/site-videos/video-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'unpublish' }),
    }), params);
    expect(response.status).toBe(200);
    expect(muxRequest).toHaveBeenCalledWith(
      '/assets/asset-1/playback-ids/playback-1', 'DELETE',
    );
    expect(db.profileVideo.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { muxPlaybackId: null, isPublished: false },
    }));
  });

  it('does not allow publishing new videos while uploads are disabled', async () => {
    const response = await PATCH(new Request('https://ihype.org/api/site-videos/video-1', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'publish' }),
    }), params);
    expect(response.status).toBe(503);
    expect(muxRequest).not.toHaveBeenCalled();
  });

  it('still removes video from external providers and database after disabling uploads', async () => {
    const response = await DELETE(
      new Request('https://ihype.org/api/site-videos/video-1', { method: 'DELETE' }), params,
    );
    expect(response.status).toBe(200);
    expect(deleteHostedProfileVideo).toHaveBeenCalledWith(expect.objectContaining({
      muxAssetId: 'asset-1',
    }));
    expect(db.profileVideo.delete).toHaveBeenCalledWith({ where: { id: 'video-1' } });
  });
});

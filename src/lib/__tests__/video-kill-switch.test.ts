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
  MuxApiError: class MuxApiError extends Error {
    constructor(readonly status: number) {
      super(`Provider returned HTTP ${status}`);
    }
  },
}));
vi.mock('@/lib/delete-hosted-video', () => ({
  deleteHostedProfileVideo: vi.fn().mockResolvedValue(undefined),
}));

import { PATCH, DELETE } from '@/app/api/site-videos/[id]/route';
import { auth } from '@/lib/auth';
import { canManageOwnedResource } from '@/lib/permissions';
import { db } from '@/lib/db';
import { isVideoUploadEnabled, muxRequest } from '@/lib/mux-video';
import { deleteHostedProfileVideo } from '@/lib/delete-hosted-video';
import { DEFAULT_SITE_CONFIG } from '@/lib/profile-site';

const findVideo = db.profileVideo.findUnique as unknown as ReturnType<typeof vi.fn>;
const originalVideo = {
  id: 'video-1', muxUploadId: 'upload-1', muxAssetId: 'asset-1',
  muxPlaybackId: 'playback-1', status: 'READY', isPublished: true,
  archiveKey: null, archiveUploadId: null,
  profile: {
    ownerId: 'owner-1', type: 'ARTIST', verificationStatus: 'VERIFIED',
    discoverable: true, siteConfig: { ...DEFAULT_SITE_CONFIG, published: true },
  },
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

  it('rejects other owners without contacting Mux', async () => {
    vi.mocked(canManageOwnedResource).mockReturnValueOnce(false);
    const response = await PATCH(new Request('https://ihype.org/api/site-videos/video-1', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'unpublish' }),
    }), params);
    expect(response.status).toBe(404);
    expect(muxRequest).not.toHaveBeenCalled();
  });

  it('rejects anonymous deletion even when uploads are disabled', async () => {
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    const response = await DELETE(
      new Request('https://ihype.org/api/site-videos/video-1', { method: 'DELETE' }), params,
    );
    expect(response.status).toBe(401);
    expect(deleteHostedProfileVideo).not.toHaveBeenCalled();
  });

  it('allows unpublishing an ERROR state asset with an existing public playback ID', async () => {
    findVideo.mockResolvedValueOnce({ ...originalVideo, status: 'ERROR' });
    const response = await PATCH(new Request('https://ihype.org/api/site-videos/video-1', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'unpublish' }),
    }), params);
    expect(response.status).toBe(200);
    expect(muxRequest).toHaveBeenCalledWith(
      '/assets/asset-1/playback-ids/playback-1', 'DELETE',
    );
  });

  it('refuses to create public playback IDs on hidden or unpublished websites', async () => {
    vi.mocked(isVideoUploadEnabled).mockReturnValue(true);
    findVideo.mockResolvedValueOnce({
      ...originalVideo, isPublished: false, muxPlaybackId: null,
      profile: { ...originalVideo.profile, siteConfig: DEFAULT_SITE_CONFIG },
    });
    const unpublished = await PATCH(new Request('https://ihype.org/api/site-videos/video-1', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'publish' }),
    }), params);
    expect(unpublished.status).toBe(403);
    findVideo.mockResolvedValueOnce({
      ...originalVideo, isPublished: false, muxPlaybackId: null,
      profile: { ...originalVideo.profile, discoverable: false },
    });
    const hidden = await PATCH(new Request('https://ihype.org/api/site-videos/video-1', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'publish' }),
    }), params);
    expect(hidden.status).toBe(403);
    expect(muxRequest).not.toHaveBeenCalled();
  });

  it('revokes a newly issued public ID if persisting publication fails', async () => {
    vi.mocked(isVideoUploadEnabled).mockReturnValueOnce(true);
    findVideo.mockResolvedValueOnce({
      ...originalVideo, isPublished: false, muxPlaybackId: null,
    });
    vi.mocked(db.profileVideo.updateMany).mockRejectedValueOnce(new Error('database write failed'));
    const host = muxRequest as unknown as ReturnType<typeof vi.fn>;
    host.mockResolvedValueOnce({ id: 'new-public-playback' }).mockResolvedValueOnce({});
    const response = await PATCH(new Request('https://ihype.org/api/site-videos/video-1', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'publish' }),
    }), params);
    expect(response.status).toBe(502);
    expect(host).toHaveBeenNthCalledWith(
      1, '/assets/asset-1/playback-ids', 'POST', { policy: 'public' },
    );
    expect(host).toHaveBeenNthCalledWith(
      2, '/assets/asset-1/playback-ids/new-public-playback', 'DELETE',
    );
  });

  it('revokes Mux public ID when a simultaneous website-unpublish wins the database claim', async () => {
    vi.mocked(isVideoUploadEnabled).mockReturnValueOnce(true);
    findVideo.mockResolvedValueOnce({
      ...originalVideo, isPublished: false, muxPlaybackId: null,
    });
    const provider = muxRequest as unknown as ReturnType<typeof vi.fn>;
    provider.mockResolvedValueOnce({ id: 'race-public-id' }).mockResolvedValueOnce({});
    vi.mocked(db.profileVideo.updateMany).mockResolvedValueOnce({ count: 0 });
    const response = await PATCH(new Request('https://ihype.org/api/site-videos/video-1', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'publish' }),
    }), params);
    expect(response.status).toBe(502);
    expect(db.profileVideo.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        profile: { is: {
          discoverable: true,
          verificationStatus: 'VERIFIED',
          siteConfig: { path: ['published'], equals: true },
        } },
      }),
    }));
    expect(provider).toHaveBeenNthCalledWith(
      2, '/assets/asset-1/playback-ids/race-public-id', 'DELETE',
    );
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

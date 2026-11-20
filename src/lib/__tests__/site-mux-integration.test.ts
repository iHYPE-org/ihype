import { beforeEach, describe, expect, it, vi } from 'vitest';

// Route-level integration tests: actual Next route handlers and validation,
// with deterministic session/DB/Mux boundaries. No paid Mux assets are made.
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/db', () => ({
  db: {
    profile: { findUnique: vi.fn(), update: vi.fn() },
    profileVideo: {
      count: vi.fn(), create: vi.fn(), update: vi.fn(),
      delete: vi.fn(), findMany: vi.fn(), updateMany: vi.fn(),
    },
  },
  withDbRetry: (call: () => Promise<unknown>) => call(),
}));
vi.mock('@/lib/permissions', () => ({
  canManageOwnedResource: vi.fn(),
}));
vi.mock('@/lib/rate-limit', () => ({
  consumeRateLimit: vi.fn(),
}));
vi.mock('@/lib/mux-video', () => ({
  isVideoUploadEnabled: vi.fn(),
  muxRequest: vi.fn(),
  MuxApiError: class MuxApiError extends Error {
    constructor(readonly status: number) { super(`Mux returned ${status}`); }
  },
}));

import { GET as getSite, PATCH as saveSite } from '@/app/api/site-builder/route';
import { GET as getVideos, POST as uploadVideo } from '@/app/api/site-videos/route';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { canManageOwnedResource } from '@/lib/permissions';
import { consumeRateLimit } from '@/lib/rate-limit';
import { isVideoUploadEnabled, muxRequest } from '@/lib/mux-video';
import { DEFAULT_SITE_CONFIG } from '@/lib/profile-site';

const stub = (fn: unknown) => fn as ReturnType<typeof vi.fn>;
const profileFind = stub(db.profile.findUnique);
const profileUpdate = stub(db.profile.update);
const videoCreate = stub(db.profileVideo.create);
const videoCount = stub(db.profileVideo.count);
const videoUpdate = stub(db.profileVideo.update);
const videoDelete = stub(db.profileVideo.delete);
const videoList = stub(db.profileVideo.findMany);
const videoUpdateMany = stub(db.profileVideo.updateMany);
const signedIn = stub(auth);
const ownerAllowed = stub(canManageOwnedResource);
const rateLimit = stub(consumeRateLimit);
const muxEnabled = stub(isVideoUploadEnabled);
const provider = stub(muxRequest);

const profile = {
  id: 'profile-1', ownerId: 'owner-1', slug: 'test-artist',
  name: 'Test Artist', type: 'ARTIST', verificationStatus: 'VERIFIED',
  discoverable: true, headline: 'Original music', bio: 'Test biography',
  heroImage: null, siteConfig: null,
};

const requestForSite = (published: boolean) => new Request('https://ihype.org/api/site-builder', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    profileId: 'profile-1',
    site: { ...DEFAULT_SITE_CONFIG, published },
  }),
});

const requestForVideo = (overrides: Record<string, unknown> = {}, headers: Record<string, string> = {}) =>
  new Request('https://ihype.org/api/site-videos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({
      profileId: 'profile-1',
      title: 'Original concert',
      quality: '2160p',
      fileSizeBytes: 7_000_000,
      rightsConfirmed: true,
      ...overrides,
    }),
  });

beforeEach(() => {
  vi.resetAllMocks();
  signedIn.mockResolvedValue({ user: { id: 'owner-1' } });
  ownerAllowed.mockReturnValue(true);
  rateLimit.mockResolvedValue({ allowed: true });
  profileFind.mockResolvedValue(profile);
  profileUpdate.mockResolvedValue({});
  videoCount.mockResolvedValue(0);
  videoCreate.mockResolvedValue({ id: 'video-1' });
  videoUpdate.mockResolvedValue({});
  videoDelete.mockResolvedValue({});
  videoList.mockResolvedValue([]);
  videoUpdateMany.mockResolvedValue({ count: 1 });
  muxEnabled.mockReturnValue(true);
  provider.mockResolvedValue({
    id: 'mux-upload-1',
    url: 'https://storage.googleapis.com/mux-test-upload',
  });
});

describe('Artist/venue site and video integration boundaries', () => {
  it('returns unpublished, private-contact defaults for the authorized owner', async () => {
    const response = await getSite(new Request('https://ihype.org/api/site-builder?profileId=profile-1'));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      profile: { id: 'profile-1', name: 'Test Artist' },
      site: { published: false, sections: { contact: false } },
    });
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });

  it('allows draft editing before artist verification, without publishing a page', async () => {
    profileFind.mockResolvedValueOnce({ ...profile, verificationStatus: 'PENDING' });
    const response = await saveSite(requestForSite(false));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, url: null });
    expect(profileUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: { siteConfig: expect.objectContaining({ published: false }) },
    }));
  });

  it('blocks publishing unverified or undiscoverable identities, while keeping drafts available', async () => {
    profileFind.mockResolvedValueOnce({ ...profile, verificationStatus: 'PENDING' });
    expect((await saveSite(requestForSite(true))).status).toBe(403);
    profileFind.mockResolvedValueOnce({ ...profile, discoverable: false });
    expect((await saveSite(requestForSite(true))).status).toBe(403);
    expect(profileUpdate).not.toHaveBeenCalled();
  });

  it('hides a website and revokes every previously published Mux playback ID', async () => {
    videoList.mockResolvedValueOnce([{
      id: 'video-1', muxAssetId: 'asset-1', muxPlaybackId: 'public-1',
    }]);
    const response = await saveSite(requestForSite(false));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      site: { published: false }, url: null, ok: true,
    });
    expect(profileUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: { siteConfig: expect.objectContaining({ published: false }) },
    }));
    expect(provider).toHaveBeenCalledWith('/assets/asset-1/playback-ids/public-1', 'DELETE');
    expect(videoUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'video-1', muxPlaybackId: 'public-1' },
      data: { muxPlaybackId: null, isPublished: false },
    }));
  });

  it('hides the site but warns if Mux is unavailable, retaining the playback cleanup ID', async () => {
    videoList.mockResolvedValueOnce([{
      id: 'video-1', muxAssetId: 'asset-1', muxPlaybackId: 'public-1',
    }]);
    provider.mockRejectedValueOnce(new Error('Mux offline'));
    const response = await saveSite(requestForSite(false));
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.site.published).toBe(false);
    expect(result.warning).toMatch(/previously public video links/);
    expect(videoUpdateMany).not.toHaveBeenCalled();
  });

  it('publishes an approved, discoverable artist page to its own URL', async () => {
    const response = await saveSite(requestForSite(true));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, url: '/site/test-artist' });
  });

  it('denies anonymous and cross-owner page editing before any database changes', async () => {
    signedIn.mockResolvedValueOnce(null);
    expect((await saveSite(requestForSite(false))).status).toBe(401);
    ownerAllowed.mockReturnValueOnce(false);
    expect((await saveSite(requestForSite(false))).status).toBe(403);
    expect(profileUpdate).not.toHaveBeenCalled();
  });

  it('refuses new Mux uploads when the sitewide allowance is exhausted', async () => {
    rateLimit.mockResolvedValueOnce({ allowed: true });
    rateLimit.mockResolvedValueOnce({ allowed: false, remaining: 0, retryAfterSeconds: 120 });

    const response = await uploadVideo(requestForVideo());

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('120');
    expect(rateLimit).toHaveBeenNthCalledWith(2, expect.stringMatching(/^mux-video-sitewide:\d{4}-\d{2}$/),
      expect.objectContaining({ limit: 20, requireAtomic: true }));
    expect(videoCreate).not.toHaveBeenCalled();
    expect(provider).not.toHaveBeenCalled();
  });

  it('creates a private, 4K-capable Mux direct upload without a playback ID', async () => {
    const response = await uploadVideo(requestForVideo());
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      id: 'video-1',
      uploadUrl: 'https://storage.googleapis.com/mux-test-upload',
    });
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(provider).toHaveBeenCalledWith('/uploads', 'POST', expect.objectContaining({
      cors_origin: 'https://ihype.org',
      new_asset_settings: expect.objectContaining({
        video_quality: 'basic',
        max_resolution_tier: '2160p',
        playback_policies: [],
        meta: expect.objectContaining({
          external_id: 'video-1',
          creator_id: 'profile-1',
        }),
      }),
    }));
    expect(videoUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: { muxUploadId: 'mux-upload-1' },
    }));
  });

  it('accepts the newer Mux-hosted direct upload endpoint', async () => {
    provider.mockResolvedValueOnce({
      id: 'mux-upload-1', url: 'https://uploads.mux.com/signed-direct-upload',
    });
    const response = await uploadVideo(requestForVideo());
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      uploadUrl: 'https://uploads.mux.com/signed-direct-upload',
    });
  });

  it('cancels a reserved provider upload and deletes the draft if its URL points to an untrusted host', async () => {
    provider.mockResolvedValueOnce({
      id: 'mux-upload-1', url: 'https://uploads.mux.com.attacker.example/file',
    }).mockResolvedValueOnce({});
    const response = await uploadVideo(requestForVideo());
    expect(response.status).toBe(502);
    expect(provider).toHaveBeenCalledWith('/uploads/mux-upload-1/cancel', 'PUT');
    expect(videoUpdate).not.toHaveBeenCalled();
    expect(videoDelete).toHaveBeenCalledWith({ where: { id: 'video-1' } });
  });

  it('defaults new uploads to lower-cost 1080p unless the owner chooses 4K', async () => {
    const response = await uploadVideo(requestForVideo({ quality: undefined }));
    expect(response.status).toBe(201);
    expect(provider).toHaveBeenCalledWith('/uploads', 'POST', expect.objectContaining({
      new_asset_settings: expect.objectContaining({ max_resolution_tier: '1080p' }),
    }));
  });

  it('denies video uploads for anonymous users, other owners, and unverified artists', async () => {
    signedIn.mockResolvedValueOnce(null);
    expect((await uploadVideo(requestForVideo())).status).toBe(401);
    ownerAllowed.mockReturnValueOnce(false);
    expect((await uploadVideo(requestForVideo())).status).toBe(404);
    profileFind.mockResolvedValueOnce({ ...profile, verificationStatus: 'UNVERIFIED' });
    expect((await uploadVideo(requestForVideo())).status).toBe(403);
    expect(videoCreate).not.toHaveBeenCalled();
    expect(provider).not.toHaveBeenCalled();
  });

  it('rejects upload without rights, over-limit size, and cross-origin requests', async () => {
    expect((await uploadVideo(requestForVideo({ rightsConfirmed: false }))).status).toBe(400);
    expect((await uploadVideo(requestForVideo({ fileSizeBytes: 3_000_000_000 }))).status).toBe(400);
    expect((await uploadVideo(requestForVideo({}, { origin: 'https://attacker.example' }))).status).toBe(403);
    expect(provider).not.toHaveBeenCalled();
  });

  it('allows video library reads while new uploads are disabled', async () => {
    muxEnabled.mockReturnValue(false);
    const response = await getVideos(new Request('https://ihype.org/api/site-videos?profileId=profile-1'));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ enabled: false, videos: [] });
    expect((await uploadVideo(requestForVideo())).status).toBe(503);
  });

  it('cancels the Mux direct upload when the database cannot persist its identifier', async () => {
    videoUpdate.mockRejectedValueOnce(new Error('database unavailable'));
    provider.mockResolvedValueOnce({
      id: 'mux-upload-1', url: 'https://storage.googleapis.com/mux-test-upload',
    }).mockResolvedValueOnce({});
    const response = await uploadVideo(requestForVideo());
    expect(response.status).toBe(502);
    expect(provider).toHaveBeenCalledWith('/uploads/mux-upload-1/cancel', 'PUT');
    expect(videoDelete).toHaveBeenCalledWith({ where: { id: 'video-1' } });
  });

  it('leaves an owner-recoverable video record if provider cancellation fails', async () => {
    videoUpdate.mockRejectedValueOnce(new Error('database unavailable'));
    provider.mockResolvedValueOnce({
      id: 'mux-upload-1', url: 'https://storage.googleapis.com/mux-test-upload',
    }).mockRejectedValueOnce(new Error('provider unavailable'));
    const response = await uploadVideo(requestForVideo());
    expect(response.status).toBe(502);
    expect(videoDelete).not.toHaveBeenCalled();
    expect(videoUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: { muxUploadId: 'mux-upload-1', status: 'ERROR' },
    }));
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: 'owner-1' } }),
}));
vi.mock('@/lib/db', () => ({
  db: {
    profileVideo: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
  },
  withDbRetry: (call: () => Promise<unknown>) => call(),
}));
vi.mock('@/lib/permissions', () => ({
  canManageOwnedResource: vi.fn().mockReturnValue(true),
}));
vi.mock('@/lib/mux-video', () => ({
  isR2VideoArchiveEnabled: vi.fn().mockReturnValue(false),
}));
vi.mock('@/lib/runtime-env', () => ({
  readRuntimeBinding: vi.fn(() => ({
    createMultipartUpload: vi.fn(),
    resumeMultipartUpload: vi.fn(() => ({
      abort: vi.fn().mockResolvedValue(undefined),
    })),
    head: vi.fn().mockResolvedValue(null),
  })),
}));
vi.mock('@/lib/r2-object-response', () => ({
  readMediaBucket: vi.fn(),
  serveR2Object: vi.fn(),
}));
vi.mock('@/lib/rate-limit', () => ({
  consumeRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
}));

import { POST, PUT } from '@/app/api/site-videos/archive/route';
import { db } from '@/lib/db';
import { canManageOwnedResource } from '@/lib/permissions';

const findVideo = db.profileVideo.findUnique as unknown as ReturnType<typeof vi.fn>;
const profileVideo = {
  id: 'video-1', profileId: 'profile-1',
  archiveKey: 'video-originals/profile-1/video-1.mp4',
  archiveUploadId: 'upload-1',
  profile: { ownerId: 'owner-1', type: 'ARTIST' },
};

function req(action: 'abort' | 'start') {
  return new Request('https://ihype.org/api/site-videos/archive', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, videoId: 'video-1',
      ...(action === 'start' ? { mimeType: 'video/mp4' } : {}) }),
  });
}

describe('R2 original-file archive kill switch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findVideo.mockResolvedValue(profileVideo);
    vi.mocked(canManageOwnedResource).mockReturnValue(true);
  });

  it('allows aborting an existing private archive after uploads are paused', async () => {
    const response = await POST(req('abort'));
    expect(response.status).toBe(200);
    expect(db.profileVideo.update).toHaveBeenCalledWith({
      where: { id: 'video-1' }, data: { archiveKey: null, archiveUploadId: null },
    });
  });

  it('blocks creating a new archive while uploads are paused', async () => {
    const response = await POST(req('start'));
    expect(response.status).toBe(503);
  });

  it('blocks adding new chunks while uploads are paused', async () => {
    const response = await PUT(new Request(
      'https://ihype.org/api/site-videos/archive?videoId=video-1&part=1',
      { method: 'PUT', body: new Uint8Array([1, 2, 3]) },
    ));
    expect(response.status).toBe(503);
  });

  it('rejects cross-owner archive cleanup', async () => {
    vi.mocked(canManageOwnedResource).mockReturnValueOnce(false);
    const response = await POST(req('abort'));
    expect(response.status).toBe(404);
    expect(db.profileVideo.update).not.toHaveBeenCalled();
  });
});

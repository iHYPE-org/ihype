import { beforeEach, describe, expect, it, vi } from 'vitest';

// Real Next route handlers, fake in-memory R2 multipart operation, scratch
// authorization boundaries. No external Cloudflare bucket is written.
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/db', () => ({
  db: { profileVideo: {
    findUnique: vi.fn(), updateMany: vi.fn(), update: vi.fn(),
  } },
  withDbRetry: (fn: () => Promise<unknown>) => fn(),
}));
vi.mock('@/lib/permissions', () => ({
  canManageOwnedResource: vi.fn(),
}));
vi.mock('@/lib/runtime-env', () => ({
  readRuntimeBinding: vi.fn(),
}));
vi.mock('@/lib/mux-video', () => ({
  isR2VideoArchiveEnabled: vi.fn(),
}));
vi.mock('@/lib/r2-object-response', () => ({
  readMediaBucket: vi.fn(),
  serveR2Object: vi.fn(),
}));
vi.mock('@/lib/rate-limit', () => ({
  consumeRateLimit: vi.fn(),
}));

import { POST, PUT, GET } from '@/app/api/site-videos/archive/route';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { canManageOwnedResource } from '@/lib/permissions';
import { isR2VideoArchiveEnabled } from '@/lib/mux-video';
import { readRuntimeBinding } from '@/lib/runtime-env';
import { consumeRateLimit } from '@/lib/rate-limit';

const stub = (fn: unknown) => fn as ReturnType<typeof vi.fn>;
const signedIn = stub(auth);
const videoFind = stub(db.profileVideo.findUnique);
const videoUpdateMany = stub(db.profileVideo.updateMany);
const videoUpdate = stub(db.profileVideo.update);
const ownerAllowed = stub(canManageOwnedResource);
const archiveEnabled = stub(isR2VideoArchiveEnabled);
const runtimeBinding = stub(readRuntimeBinding);
const limit = stub(consumeRateLimit);

const profileVideo = {
  id: 'video-1', profileId: 'artist-1', title: 'New video',
  archiveKey: null, archiveUploadId: null,
  profile: { ownerId: 'owner-1', type: 'ARTIST' },
};
const inProgress = {
  ...profileVideo,
  archiveKey: 'video-originals/artist-1/video-1.mp4',
  archiveUploadId: 'multipart-1',
};
const startRequest = () => new Request('https://ihype.org/api/site-videos/archive', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'start', videoId: 'video-1', mimeType: 'video/mp4' }),
});
const completeRequest = () => new Request('https://ihype.org/api/site-videos/archive', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'complete', videoId: 'video-1',
    parts: [{ partNumber: 1, etag: 'etag-1' }] }),
});
const partRequest = (body: Uint8Array) => new Request(
  'https://ihype.org/api/site-videos/archive?videoId=video-1&part=1',
  { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' },
    body: body as unknown as BodyInit },
);

let bucket: {
  createMultipartUpload: ReturnType<typeof vi.fn>;
  resumeMultipartUpload: ReturnType<typeof vi.fn>;
  head: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};
let multipart: {
  uploadId: string;
  uploadPart: ReturnType<typeof vi.fn>;
  complete: ReturnType<typeof vi.fn>;
  abort: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.resetAllMocks();
  signedIn.mockResolvedValue({ user: { id: 'owner-1' } });
  ownerAllowed.mockReturnValue(true);
  archiveEnabled.mockReturnValue(true);
  limit.mockResolvedValue({ allowed: true });
  videoFind.mockResolvedValue(profileVideo);
  videoUpdateMany.mockResolvedValue({ count: 1 });
  videoUpdate.mockResolvedValue({});
  multipart = {
    uploadId: 'multipart-1',
    uploadPart: vi.fn().mockResolvedValue({ partNumber: 1, etag: 'etag-1' }),
    complete: vi.fn().mockResolvedValue(undefined),
    abort: vi.fn().mockResolvedValue(undefined),
  };
  bucket = {
    createMultipartUpload: vi.fn().mockResolvedValue(multipart),
    resumeMultipartUpload: vi.fn().mockReturnValue(multipart),
    head: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue(undefined),
  };
  runtimeBinding.mockReturnValue(bucket);
});

describe('R2 original video multipart route integration', () => {
  it('creates only a private original-video key, persisted with the multipart upload ID', async () => {
    const response = await POST(startRequest());
    expect(response.status).toBe(200);
    expect(bucket.createMultipartUpload).toHaveBeenCalledWith(
      'video-originals/artist-1/video-1.mp4',
      { httpMetadata: { contentType: 'video/mp4' } },
    );
    expect(videoUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: {
        archiveKey: 'video-originals/artist-1/video-1.mp4',
        archiveUploadId: 'multipart-1',
      },
    }));
  });

  it('streams a bounded part to the same private multipart object', async () => {
    videoFind.mockResolvedValueOnce(inProgress);
    const response = await PUT(partRequest(new Uint8Array([1, 2, 3])));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ partNumber: 1, etag: 'etag-1' });
    expect(bucket.resumeMultipartUpload).toHaveBeenCalledWith(
      inProgress.archiveKey, 'multipart-1',
    );
    const call = multipart.uploadPart.mock.calls[0];
    expect(call[0]).toBe(1);
    expect(call[1]).toBeInstanceOf(ArrayBuffer);
    expect(new Uint8Array(call[1])).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('rejects chunks exceeding 8 MiB without calling R2', async () => {
    videoFind.mockResolvedValueOnce(inProgress);
    const response = await PUT(partRequest(new Uint8Array(8 * 1024 * 1024 + 1)));
    expect(response.status).toBe(413);
    expect(multipart.uploadPart).not.toHaveBeenCalled();
  });

  it('finalizes only ordered committed ETags and clears the in-progress marker', async () => {
    videoFind.mockResolvedValueOnce(inProgress);
    const response = await POST(completeRequest());
    expect(response.status).toBe(200);
    expect(multipart.complete).toHaveBeenCalledWith([
      { partNumber: 1, etag: 'etag-1' },
    ]);
    expect(videoUpdate).toHaveBeenCalledWith({
      where: { id: 'video-1' }, data: { archiveUploadId: null },
    });
  });

  it('reconciles an R2 completion when the prior database write did not finish', async () => {
    videoFind.mockResolvedValueOnce(inProgress);
    const noSuchUpload = Object.assign(new Error('NoSuchUpload'), { code: 'NoSuchUpload' });
    multipart.complete.mockRejectedValueOnce(noSuchUpload);
    bucket.head.mockResolvedValueOnce({ size: 1024 });
    const response = await POST(completeRequest());
    expect(response.status).toBe(200);
    expect(videoUpdate).toHaveBeenCalledWith({
      where: { id: 'video-1' }, data: { archiveUploadId: null },
    });
  });

  it('aborts the R2 upload if its database claim fails', async () => {
    videoUpdateMany.mockRejectedValueOnce(new Error('DB unavailable'));
    const response = await POST(startRequest());
    expect(response.status).toBe(502);
    expect(multipart.abort).toHaveBeenCalled();
  });

  it('refuses anonymous or other-owner access before any archive operation', async () => {
    signedIn.mockResolvedValueOnce(null);
    expect((await POST(startRequest())).status).toBe(401);
    ownerAllowed.mockReturnValueOnce(false);
    expect((await POST(startRequest())).status).toBe(404);
    expect(bucket.createMultipartUpload).not.toHaveBeenCalled();
    expect(multipart.uploadPart).not.toHaveBeenCalled();
  });

  it('refuses private-original download requests for another profile owner', async () => {
    videoFind.mockResolvedValueOnce({
      ...inProgress, archiveUploadId: null,
    });
    ownerAllowed.mockReturnValueOnce(false);
    const response = await GET(
      new Request('https://ihype.org/api/site-videos/archive?videoId=video-1'),
    );
    expect(response.status).toBe(404);
  });
});

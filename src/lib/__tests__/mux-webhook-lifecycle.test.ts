import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({
  db: {
    profileVideo: {
      findFirst: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  },
}));
vi.mock('@/lib/runtime-env', () => ({
  readRuntimeEnv: vi.fn((name: string) => name === 'MUX_WEBHOOK_SECRET' ? 'mux-signing-test-secret' : undefined),
}));
vi.mock('@/lib/mux-video', async (loadActual) => ({
  ...(await loadActual<typeof import('@/lib/mux-video')>()),
  muxRequest: vi.fn().mockResolvedValue({}),
}));

import { POST } from '@/app/api/webhooks/mux/route';
import { db } from '@/lib/db';
import { muxRequest } from '@/lib/mux-video';

const mockedFind = db.profileVideo.findFirst as unknown as ReturnType<typeof vi.fn>;
const mockedUpdate = db.profileVideo.updateMany as unknown as ReturnType<typeof vi.fn>;
const mockedFindMany = db.profileVideo.findMany as unknown as ReturnType<typeof vi.fn>;
const mockedMux = muxRequest as unknown as ReturnType<typeof vi.fn>;

async function signedMuxEvent(data: Record<string, unknown>, type = 'video.asset.ready') {
  const raw = JSON.stringify({ type, data });
  const ts = Math.floor(Date.now() / 1000);
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode('mux-signing-test-secret'),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(`${ts}.${raw}`)));
  const hex = [...signature].map(byte => byte.toString(16).padStart(2, '0')).join('');
  return new Request('https://ihype.org/api/webhooks/mux', {
    method: 'POST',
    headers: { 'mux-signature': `t=${ts},v1=${hex}`, 'content-type': 'application/json' },
    body: raw,
  });
}
const assetData = {
  id: 'mux-asset-1',
  upload_id: 'mux-upload-1',
  meta: { external_id: 'ihype-video-1' },
};

describe('signed Mux asset lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedFind.mockResolvedValue({ id: 'ihype-video-1', muxAssetId: null, status: 'PROCESSING' });
    mockedUpdate.mockResolvedValue({ count: 1 });
    mockedFindMany.mockResolvedValue([]);
    mockedMux.mockResolvedValue({});
  });

  it('rejects unsigned events before touching a video', async () => {
    const response = await POST(new Request('https://ihype.org/api/webhooks/mux', {
      method: 'POST', body: JSON.stringify({ type: 'video.asset.ready', data: assetData }),
    }));
    expect(response.status).toBe(401);
    expect(mockedFind).not.toHaveBeenCalled();
  });

  it('marks short videos READY but not published', async () => {
    const response = await POST(await signedMuxEvent({ ...assetData, duration: 82 }));
    expect(response.status).toBe(200);
    expect(mockedUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: { in: ['WAITING', 'PROCESSING'] } }),
      data: { muxAssetId: 'mux-asset-1', status: 'READY', durationSecs: 82 },
    }));
    expect(mockedMux).not.toHaveBeenCalled();
  });

  it('blocks and removes overlong videos without exposing a playback ID', async () => {
    const response = await POST(await signedMuxEvent({ ...assetData, duration: 901 }));
    expect(response.status).toBe(200);
    expect(mockedUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: 'TOO_LONG', isPublished: false,
      }),
    }));
    expect(mockedMux).toHaveBeenCalledWith('/assets/mux-asset-1', 'DELETE');
    expect(mockedUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'ihype-video-1', muxAssetId: 'mux-asset-1', status: 'TOO_LONG' },
      data: { muxPlaybackId: null },
    }));
  });

  it('retains the public cleanup handle until an overlong Mux asset is actually deleted', async () => {
    mockedMux.mockRejectedValueOnce(new Error('Mux storage unavailable'));
    await expect(POST(await signedMuxEvent({ ...assetData, duration: 901 })))
      .rejects.toThrow('Mux storage unavailable');
    expect(mockedUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'TOO_LONG', isPublished: false }),
    }));
    expect(mockedUpdate).not.toHaveBeenCalledWith(expect.objectContaining({
      data: { muxPlaybackId: null },
    }));
    // Mux will retry this signed webhook; a new delivery can finish cleanup.
  });

  it('does not mark a video READY without verified duration', async () => {
    const response = await POST(await signedMuxEvent(assetData));
    expect(response.status).toBe(200);
    expect(mockedUpdate).not.toHaveBeenCalled();
    expect(mockedMux).not.toHaveBeenCalled();
  });

  it('revokes a live public playback ID after a signed provider error', async () => {
    mockedFindMany.mockResolvedValueOnce([{
      id: 'ihype-video-1', muxAssetId: 'mux-asset-1', muxPlaybackId: 'public-1',
    }]);
    const response = await POST(await signedMuxEvent(assetData, 'video.asset.errored'));
    expect(response.status).toBe(200);
    expect(mockedUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: { status: 'ERROR', isPublished: false },
    }));
    expect(mockedMux).toHaveBeenCalledWith('/assets/mux-asset-1/playback-ids/public-1', 'DELETE');
    expect(mockedUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'ihype-video-1', muxPlaybackId: 'public-1' },
      data: { muxPlaybackId: null },
    }));
  });

  it('retains a public playback ID for webhook retry if provider deletion fails', async () => {
    mockedFindMany.mockResolvedValueOnce([{
      id: 'ihype-video-1', muxAssetId: 'mux-asset-1', muxPlaybackId: 'public-1',
    }]);
    mockedMux.mockRejectedValueOnce(new Error('Mux unavailable'));
    await expect(POST(await signedMuxEvent(assetData, 'video.asset.errored')))
      .rejects.toThrow('Mux unavailable');
    expect(mockedUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: { status: 'ERROR', isPublished: false },
    }));
    expect(mockedUpdate).not.toHaveBeenCalledWith(expect.objectContaining({
      data: { muxPlaybackId: null },
    }));
  });

  it('ignores unrelated assets in a shared Mux environment', async () => {
    mockedFind.mockResolvedValueOnce(null);
    const response = await POST(await signedMuxEvent({ ...assetData, duration: 901 }));
    expect(response.status).toBe(200);
    expect(mockedUpdate).not.toHaveBeenCalled();
    expect(mockedMux).not.toHaveBeenCalled();
  });
});

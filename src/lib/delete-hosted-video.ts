import { readRuntimeBinding } from '@/lib/runtime-env';
import { MuxApiError, muxRequest } from '@/lib/mux-video';

/**
 * Deleting the database row does not delete an external Mux video or a private
 * R2 original. Keep this cleanup reusable by video-delete AND account-erasure.
 * A provider failure is fatal: leave the DB row intact so the operation can
 * be retried without silently leaking private assets or storage charges.
 */
export async function deleteHostedProfileVideo(video: {
  muxAssetId: string | null;
  muxUploadId: string;
  archiveKey: string | null;
  archiveUploadId: string | null;
}): Promise<void> {
  if (video.muxAssetId) {
    try {
      await muxRequest(`/assets/${video.muxAssetId}`, 'DELETE');
    } catch (err) {
      if (!(err instanceof MuxApiError && err.status === 404)) throw err;
    }
  } else if (!video.muxUploadId.startsWith('pending_')) {
    // Webhooks can lag behind Mux: fetch the upload before deciding whether
    // to cancel an incomplete upload or remove the already-created asset.
    let upload: { status: string; asset_id?: string } | null = null;
    try {
      upload = await muxRequest<{ status: string; asset_id?: string }>(
        `/uploads/${video.muxUploadId}`, 'GET',
      );
    } catch (err) {
      if (!(err instanceof MuxApiError && err.status === 404)) throw err;
    }
    if (upload?.asset_id) {
      try {
        await muxRequest(`/assets/${upload.asset_id}`, 'DELETE');
      } catch (err) {
        if (!(err instanceof MuxApiError && err.status === 404)) throw err;
      }
    } else if (upload?.status === 'waiting') {
      await muxRequest(`/uploads/${video.muxUploadId}/cancel`, 'PUT');
    } else if (upload && !['cancelled', 'errored', 'timed_out'].includes(upload.status)) {
      throw new Error('Video upload is still changing state. Retry later.');
    }
  }

  if (!video.archiveKey) return;
  // This prefix is deliberately excluded from the public /cdn allowlist.
  if (!video.archiveKey.startsWith('video-originals/')) {
    throw new Error('Invalid private archive location.');
  }
  const bucket = readRuntimeBinding('R2') as {
    delete?: (key: string) => Promise<unknown>;
    resumeMultipartUpload?: (key: string, id: string) => { abort: () => Promise<void> };
  } | null;
  if (video.archiveUploadId) {
    const upload = bucket?.resumeMultipartUpload?.(video.archiveKey, video.archiveUploadId);
    if (!upload) throw new Error('Private R2 archive is unavailable.');
    await upload.abort();
  } else {
    if (!bucket?.delete) throw new Error('Private R2 archive is unavailable.');
    await bucket.delete(video.archiveKey);
  }
}

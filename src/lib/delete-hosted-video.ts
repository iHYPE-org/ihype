import { MuxApiError, muxRequest } from '@/lib/mux-video';

/**
 * Deleting the database row does not delete an external Mux video.
 * This cleanup is shared by video deletion and account erasure.
 * A provider failure is fatal: leave the DB row intact so the operation can
 * be retried without silently leaking private assets or storage charges.
 */
export async function deleteHostedProfileVideo(video: {
  muxAssetId: string | null;
  muxUploadId: string;
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
}

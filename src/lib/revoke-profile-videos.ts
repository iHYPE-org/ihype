import { db, withDbRetry } from '@/lib/db';
import { MuxApiError, muxRequest } from '@/lib/mux-video';

/**
 * Revoke every public Mux playback ID for one profile, independently of the
 * upload feature flag. Used AFTER the caller first hides the profile/site.
 *
 * A provider failure never discards the Mux ID or pretends a link was revoked.
 * The owner can retry from Website + video, even with uploads disabled.
 */
export async function revokeProfileVideoPlayback(profileId: string): Promise<{ failed: number }> {
  const videos = await withDbRetry(() => db.profileVideo.findMany({
    where: { profileId, muxPlaybackId: { not: null } },
    select: { id: true, muxAssetId: true, muxPlaybackId: true },
  }));
  const results = await Promise.all(videos.map(async video => {
    if (!video.muxAssetId || !video.muxPlaybackId) return false;
    try {
      try {
        await muxRequest(
          `/assets/${video.muxAssetId}/playback-ids/${video.muxPlaybackId}`, 'DELETE',
        );
      } catch (error) {
        if (!(error instanceof MuxApiError && error.status === 404)) throw error;
      }
      await withDbRetry(() => db.profileVideo.updateMany({
        where: { id: video.id, muxPlaybackId: video.muxPlaybackId },
        data: { muxPlaybackId: null, isPublished: false },
      }));
      return true;
    } catch {
      return false;
    }
  }));
  return { failed: results.filter(result => !result).length };
}

export const VIDEO_REVOKE_WARNING =
  'Your profile or website is hidden, but some previously public video links could not be revoked. Open Website + video to unpublish them, then retry when Mux is available.';

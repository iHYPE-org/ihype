import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import type { Session } from 'next-auth';
import { db, withDbRetry } from '@/lib/db';
import { canManageOwnedResource } from '@/lib/permissions';
import { isVideoUploadEnabled, MuxApiError, muxRequest } from '@/lib/mux-video';
import { consumeRateLimit } from '@/lib/rate-limit';
import { deleteHostedProfileVideo } from '@/lib/delete-hosted-video';
import { isPublicSiteEligible, readProfileSiteConfig } from '@/lib/profile-site';

export const dynamic = 'force-dynamic';

async function ownedVideo(session: Session | null, id: string) {
  const video = await withDbRetry(() => db.profileVideo.findUnique({
    where: { id },
    include: { profile: { select: { ownerId: true, type: true, verificationStatus: true, discoverable: true, siteConfig: true } } },
  }));
  return video && canManageOwnedResource(session, video.profile.ownerId)
    && ['ARTIST', 'VENUE'].includes(video.profile.type) ? video : null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Login required.' }, { status: 401 });
  let action: 'publish' | 'unpublish';
  try { action = z.object({ action: z.enum(['publish', 'unpublish']) }).strict().parse(await request.json()).action; }
  catch { return NextResponse.json({ error: 'Invalid video action.' }, { status: 400 }); }
  if (action === 'publish' && !isVideoUploadEnabled()) {
    return NextResponse.json({ error: 'New video publishing is paused.' }, { status: 503 });
  }
  const { id } = await params;
  const video = await ownedVideo(session, id);
  if (!video) return NextResponse.json({ error: 'Video unavailable.' }, { status: 404 });
  const limiter = await consumeRateLimit(`mux-video-action:${session.user.id}`, { limit: 30, windowMs: 60 * 60 * 1000 });
  if (!limiter.allowed) return NextResponse.json({ error: 'Too many video changes.' }, { status: 429 });
  if (action === 'publish' && (!video.muxAssetId || video.status !== 'READY')) {
    return NextResponse.json({ error: 'Video is still processing or failed.' }, { status: 409 });
  }
  if (action === 'unpublish' && !video.muxAssetId && video.muxPlaybackId) {
    return NextResponse.json({
      error: 'Video playback needs provider reconciliation before it can be revoked.',
    }, { status: 409 });
  }
  try {
    if (action === 'publish') {
      if (video.profile.verificationStatus !== 'VERIFIED') {
        return NextResponse.json({ error: 'Ownership verification must be approved to publish.' }, { status: 403 });
      }
      if (!isPublicSiteEligible(video.profile) || !readProfileSiteConfig(video.profile.siteConfig).published) {
        return NextResponse.json({
          error: 'Publish your discoverable artist or venue website before making a video publicly playable.',
        }, { status: 403 });
      }
      if (video.isPublished && video.muxPlaybackId) return NextResponse.json({ ok: true });
      const playback = await muxRequest<{ id: string }>(
        `/assets/${video.muxAssetId}/playback-ids`, 'POST', { policy: 'public' },
      );
      if (!playback.id) throw new Error('No Mux playback ID');
      let persisted = false;
      try {
        const updated = await db.profileVideo.updateMany({
          where: {
            id: video.id, isPublished: false, muxPlaybackId: null, status: 'READY',
            // Atomic database eligibility check closes a publish/unpublish
            // race: only persist a new public ID while the website is still
            // published, discoverable and fully verified. A failed claim
            // causes the external playback ID to be deleted in finally.
            profile: {
              is: {
                discoverable: true,
                verificationStatus: 'VERIFIED',
                siteConfig: { path: ['published'], equals: true },
              },
            },
          },
          data: { muxPlaybackId: playback.id, isPublished: true },
        });
        persisted = updated.count > 0;
        if (!persisted) throw new Error('Website changed before publication could finish.');
      } finally {
        // Avoid exposing an orphaned PUBLIC playback ID if Prisma errors or
        // a concurrent publisher already claimed the record.
        if (!persisted) {
          await muxRequest(`/assets/${video.muxAssetId}/playback-ids/${playback.id}`, 'DELETE');
        }
      }
    } else {
      if (video.muxPlaybackId) {
        // Never claim privacy while the old public playback ID still works.
        try {
          await muxRequest(`/assets/${video.muxAssetId}/playback-ids/${video.muxPlaybackId}`, 'DELETE');
        } catch (error) {
          if (!(error instanceof MuxApiError && error.status === 404)) throw error;
        }
      }
      await db.profileVideo.update({
        where: { id: video.id },
        data: { muxPlaybackId: null, isPublished: false },
      });
    }
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ error: 'Video provider could not complete the change. Try again.' }, { status: 502 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Login required.' }, { status: 401 });
  const { id } = await params;
  const video = await ownedVideo(session, id);
  if (!video) return NextResponse.json({ error: 'Video unavailable.' }, { status: 404 });
  const limiter = await consumeRateLimit(`mux-video-delete:${session.user.id}`, { limit: 20, windowMs: 60 * 60 * 1000 });
  if (!limiter.allowed) return NextResponse.json({ error: 'Too many deletions.' }, { status: 429 });
  try {
    await deleteHostedProfileVideo(video);
    await db.profileVideo.delete({ where: { id: video.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Could not safely remove the video from hosting. Try again.' }, { status: 502 });
  }
}

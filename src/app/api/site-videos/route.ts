import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import type { Session } from 'next-auth';
import { db, withDbRetry } from '@/lib/db';
import { canManageOwnedResource } from '@/lib/permissions';
import { consumeRateLimit } from '@/lib/rate-limit';
import { isVideoUploadEnabled, muxRequest } from '@/lib/mux-video';
import { isAllowedMuxDirectUploadUrl } from '@/lib/mux-upload-url';

export const dynamic = 'force-dynamic';

const MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024; // initial cost/abuse guard
const MONTHLY_UPLOAD_ATTEMPTS = 20;
const MAX_VIDEOS_PER_PROFILE = 12; // raise after nonprofit credits are verified

const createSchema = z.object({
  profileId: z.string().min(1),
  title: z.string().trim().min(1).max(160),
  quality: z.enum(['1080p', '2160p']).default('1080p'),
  fileSizeBytes: z.number().int().min(1).max(MAX_VIDEO_BYTES),
  rightsConfirmed: z.literal(true),
}).strict();

async function ownedProfile(session: Session | null, profileId: string) {
  const profile = await withDbRetry(() => db.profile.findUnique({
    where: { id: profileId },
    select: { id: true, ownerId: true, type: true, verificationStatus: true },
  }));
  return profile && (profile.type === 'ARTIST' || profile.type === 'VENUE')
    && canManageOwnedResource(session, profile.ownerId) ? profile : null;
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Login required.' }, { status: 401 });
  const profileId = new URL(request.url).searchParams.get('profileId') ?? '';
  if (!profileId) return NextResponse.json({ error: 'Profile required.' }, { status: 400 });
  const profile = await ownedProfile(session, profileId);
  if (!profile) return NextResponse.json({ error: 'Profile unavailable.' }, { status: 404 });
  const videos = await withDbRetry(() => db.profileVideo.findMany({
    where: { profileId: profile.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, title: true, quality: true, status: true, isPublished: true,
      durationSecs: true, muxPlaybackId: true, createdAt: true,
    },
  }));
  return NextResponse.json({ videos, enabled: isVideoUploadEnabled() }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Login required.' }, { status: 401 });
  if (!isVideoUploadEnabled()) {
    return NextResponse.json({ error: '4K video uploads are not configured yet.' }, { status: 503 });
  }
  let body: z.infer<typeof createSchema>;
  try { body = createSchema.parse(await request.json()); }
  catch { return NextResponse.json({ error: 'Invalid file, size, or license confirmation.' }, { status: 400 }); }

  const profile = await ownedProfile(session, body.profileId);
  if (!profile) return NextResponse.json({ error: 'Profile unavailable.' }, { status: 404 });
  if (profile.verificationStatus === 'UNVERIFIED' || profile.verificationStatus === 'REJECTED') {
    return NextResponse.json({ error: 'Submit ownership verification before uploading videos.' }, { status: 403 });
  }
  const limit = await consumeRateLimit(`mux-video-create:${session.user.id}`, { limit: 8, windowMs: 60 * 60 * 1000 });
  if (!limit.allowed) return NextResponse.json({ error: 'Video upload limit reached. Try later.' }, { status: 429 });
  const count = await withDbRetry(() => db.profileVideo.count({ where: { profileId: profile.id } }));
  if (count >= MAX_VIDEOS_PER_PROFILE) {
    return NextResponse.json({ error: `Limit of ${MAX_VIDEOS_PER_PROFILE} videos per profile during beta.` }, { status: 409 });
  }

  // A signed Mux direct upload avoids passing gigabytes through the Workers
  // runtime. Scope CORS to the current origin, never "*".
  const base = new URL(request.url).origin;
  const origin = request.headers.get('origin');
  if (origin && origin !== base) {
    return NextResponse.json({ error: 'Cross-origin uploads are not allowed.' }, { status: 403 });
  }

  // Count reservations before calling Mux, including failed and canceled uploads.
  // Deleting a video does not restore its reservation.
  const now = new Date();
  const month = now.toISOString().slice(0, 7);
  const nextMonth = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
  const allowance = await consumeRateLimit(`mux-video-sitewide:${month}`, {
    limit: MONTHLY_UPLOAD_ATTEMPTS,
    windowMs: nextMonth - now.getTime(),
    requireAtomic: true,
  });
  if (!allowance.allowed) {
    return NextResponse.json({ error: 'New video uploads are temporarily unavailable.' }, {
      status: 429, headers: { 'Retry-After': String(allowance.retryAfterSeconds) },
    });
  }

  const video = await withDbRetry(() => db.profileVideo.create({
    data: {
      profileId: profile.id, title: body.title, quality: body.quality,
      muxUploadId: `pending_${crypto.randomUUID()}`, status: 'WAITING',
    },
    select: { id: true },
  }));
  let createdMuxUploadId: string | null = null;
  try {
    const upload = await muxRequest<{ id: string; url: string }>('/uploads', 'POST', {
      timeout: 3600,
      cors_origin: base,
      new_asset_settings: {
        video_quality: 'basic',
        max_resolution_tier: body.quality,
        playback_policies: [], // Explicit owner publishing creates the public ID later.
        meta: { title: body.title, external_id: video.id, creator_id: profile.id },
      },
    });
    createdMuxUploadId = upload.id || null;
    if (!upload.id || !isAllowedMuxDirectUploadUrl(upload.url)) {
      throw new Error('Video provider did not return a valid upload URL.');
    }
    await withDbRetry(() => db.profileVideo.update({
      where: { id: video.id },
      data: { muxUploadId: upload.id },
    }));
    return NextResponse.json({
      id: video.id, uploadUrl: upload.url, maxFileBytes: MAX_VIDEO_BYTES,
      message: 'Upload directly to Mux. The video will remain unpublished until you approve it.',
    }, { status: 201, headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    // A Mux upload can exist even if our DB write or response fails. Cancel
    // it rather than orphaning a potentially billable external resource.
    let safelyCancelled = true;
    if (createdMuxUploadId) {
      try {
        await muxRequest(`/uploads/${createdMuxUploadId}/cancel`, 'PUT');
      } catch {
        safelyCancelled = false;
        // Keep the provider identifier for manual or owner-initiated cleanup.
        await db.profileVideo.update({
          where: { id: video.id },
          data: { muxUploadId: createdMuxUploadId, status: 'ERROR' },
        }).catch(() => {});
      }
    }
    if (safelyCancelled) {
      await db.profileVideo.delete({ where: { id: video.id } }).catch(() => {});
    }
    return NextResponse.json({
      error: 'Video host unavailable. Nothing was published. Retry after checking your library.',
    }, { status: 502 });
  }
}

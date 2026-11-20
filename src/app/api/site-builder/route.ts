import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db, withDbRetry } from '@/lib/db';
import { canManageOwnedResource } from '@/lib/permissions';
import { isPublicSiteEligible, readProfileSiteConfig, siteConfigSchema } from '@/lib/profile-site';
import { consumeRateLimit } from '@/lib/rate-limit';
import { MuxApiError, muxRequest } from '@/lib/mux-video';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Login required.' }, { status: 401 });
  const profileId = new URL(request.url).searchParams.get('profileId') ?? '';
  if (!profileId) return NextResponse.json({ error: 'Select an artist or venue.' }, { status: 400 });
  const profile = await withDbRetry(() => db.profile.findUnique({
    where: { id: profileId },
    select: { id: true, ownerId: true, slug: true, name: true, type: true, headline: true, bio: true, heroImage: true, verificationStatus: true, discoverable: true, siteConfig: true },
  }));
  if (!profile || !['ARTIST', 'VENUE'].includes(profile.type)) {
    return NextResponse.json({ error: 'Artist or venue not found.' }, { status: 404 });
  }
  if (!canManageOwnedResource(session, profile.ownerId)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  return NextResponse.json({
    profile: { id: profile.id, slug: profile.slug, name: profile.name, type: profile.type, headline: profile.headline, bio: profile.bio, heroImage: profile.heroImage, verificationStatus: profile.verificationStatus, discoverable: profile.discoverable },
    site: readProfileSiteConfig(profile.siteConfig),
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}

const patchSchema = z.object({
  profileId: z.string().min(1),
  site: siteConfigSchema,
}).strict();

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Login required.' }, { status: 401 });
  const limit = await consumeRateLimit(`site-builder:${session.user.id}`, { limit: 30, windowMs: 60 * 60 * 1000 });
  if (!limit.allowed) return NextResponse.json({ error: 'Too many updates. Try again later.' }, { status: 429 });
  let body: z.infer<typeof patchSchema>;
  try { body = patchSchema.parse(await request.json()); }
  catch { return NextResponse.json({ error: 'Invalid website settings.' }, { status: 400 }); }

  const profile = await withDbRetry(() => db.profile.findUnique({
    where: { id: body.profileId },
    select: { id: true, slug: true, ownerId: true, type: true, verificationStatus: true, discoverable: true },
  }));
  if (!profile || !['ARTIST', 'VENUE'].includes(profile.type)) {
    return NextResponse.json({ error: 'Artist or venue not found.' }, { status: 404 });
  }
  if (!canManageOwnedResource(session, profile.ownerId)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  // Editing and saving a draft are always possible. Publishing a public
  // standalone identity requires completed ownership verification.
  if (body.site.published && profile.verificationStatus !== 'VERIFIED') {
    return NextResponse.json({
      error: 'Save as a draft for now. Your artist or venue verification must be approved before publishing.',
      verificationRequired: true,
    }, { status: 403 });
  }

  if (body.site.published && !isPublicSiteEligible(profile)) {
    return NextResponse.json({
      error: 'Make this profile discoverable in its settings before publishing a public website.',
    }, { status: 403 });
  }

  // Hide an unpublished site in Prisma FIRST, before contacting any provider.
  // A Mux outage must never leave the website publicly visible just because
  // an external playback-ID revoke failed. Keep failed provider IDs in Prisma
  // so the owner can retry from the video library (or save the draft again).
  await withDbRetry(() => db.profile.update({
    where: { id: profile.id },
    data: { siteConfig: body.site },
  }));
  let warning: string | null = null;
  if (!body.site.published) {
    try {
      const publicVideos = await withDbRetry(() => db.profileVideo.findMany({
        where: { profileId: profile.id, muxPlaybackId: { not: null } },
        select: { id: true, muxAssetId: true, muxPlaybackId: true },
      }));
      const revokeResults = await Promise.all(publicVideos.map(async video => {
        if (!video.muxPlaybackId || !video.muxAssetId) return false;
        try {
          try {
            await muxRequest(
              `/assets/${video.muxAssetId}/playback-ids/${video.muxPlaybackId}`,
              'DELETE',
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
          // The website is already hidden; an external URL may still work.
          // Do not discard its Mux playback ID until the provider confirms.
          return false;
        }
      }));
      if (revokeResults.includes(false)) {
        warning = 'Your website is hidden, but some previously public video links could not be revoked. Use Unpublish in the video library and retry when Mux is available.';
      }
    } catch {
      warning = 'Your website is hidden, but video playback cleanup could not be checked. Retry Save draft / Unpublish to revoke any previously shared video links.';
    }
  }
  return NextResponse.json({
    ok: true,
    url: body.site.published ? `/site/${profile.slug}` : null,
    site: body.site,
    ...(warning ? { warning } : {}),
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}

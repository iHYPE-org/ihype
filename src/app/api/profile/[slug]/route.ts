import { NextResponse } from 'next/server';
import type { ShowStatus } from '@prisma/client';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getDemoCreatorExclusion, isDemoUser, shouldHideDemoContent } from '@/lib/runtime-flags';
import { sanitizePublicLocation } from '@/lib/public-location';
import { releasedMediaWhere } from '@/lib/media-release';
import { canManageOwnedResource } from '@/lib/permissions';

/* Not publicly cached any more (second security scan, 2026-09-02). This
   answered anonymous callers with `revalidate = 300` — a five-minute public
   cache of a payload that carries `contactInfo` — while its only caller is
   the owner's own editor. */
export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const profile = await db.profile.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      hexId: true,
      type: true,
      name: true,
      headline: true,
      bio: true,
      aboutContent: true,
      hometown: true,
      city: true,
      stateRegion: true,
      country: true,
      addressLine1: true,
      latitude: true,
      longitude: true,
      contactInfo: true,
      hoursText: true,
      genres: true,
      hypeCount: true,
      verified: true,
      discoverable: true,
      avatarImage: true,
      heroImage: true,
      logoImage: true,
      galleryImage: true,
      parkingDetails: true,
      fanShareEnabled: true,
      createdAt: true,
      ownerId: true,
      owner: { select: { email: true, username: true } }
    }
  });

  if (!profile || (shouldHideDemoContent() && isDemoUser(profile.owner))) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  /* The owner (or an admin) sees the whole row — this is the editor's read.
     Anyone else gets the PUBLIC view: a profile that opted out of discovery
     is not served at all, and the coordination fields a fan typed into
     `contactInfo` (an email or phone, typically) stay with the owner unless
     the profile is a venue, whose contact line is its public front door.
     (Second security scan, 2026-09-02.) */
  const session = await auth().catch(() => null);
  const isOwner = canManageOwnedResource(session, profile.ownerId);
  if (!isOwner && !profile.discoverable) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  const { owner: _owner, ownerId: _ownerId, ...profileWithoutOwner } = profile;
  const located = sanitizePublicLocation(profileWithoutOwner);
  const safeProfile = isOwner || profile.type === 'VENUE'
    ? located
    : { ...located, contactInfo: null, hoursText: null, parkingDetails: null };
  const now = new Date();
  const publicShowStatuses: ShowStatus[] = ['SCHEDULED', 'LIVE'];
  const showWhere = {
    status: { in: publicShowStatuses },
    startsAt: { gte: now },
    ...getDemoCreatorExclusion()
  };

  const [shows, tracks] = await Promise.all([
    db.show.findMany({
      where: {
        ...showWhere,
        OR: [
          { venueProfileId: profile.id },
          { headlinerProfileId: profile.id },
          { promoterProfileId: profile.id }
        ]
      },
      orderBy: { startsAt: 'asc' },
      take: 10,
      select: {
        id: true,
        title: true,
        status: true,
        startsAt: true,
        isRadioShow: true,
        isTicketed: true,
        ticketPriceCents: true,
        posterImage: true,
        tags: true,
        venueProfile: { select: { name: true, slug: true, city: true, stateRegion: true } },
        headlinerProfile: { select: { name: true, slug: true } },
        promoterProfile: { select: { name: true, slug: true } }
      }
    }),
    profile.type === 'ARTIST'
      ? db.artistMediaAsset.findMany({
          // Released tracks only for anyone but the owner: a held, unpublished
          // or future-scheduled title is not public yet.
          where: { profileId: profile.id, freeUseEnabled: true, ...(isOwner ? {} : releasedMediaWhere(now)) },
          orderBy: { createdAt: 'desc' },
          take: 12,
          select: { hexId: true, title: true, mimeType: true, notes: true, createdAt: true }
        })
      : Promise.resolve([])
  ]);

  return NextResponse.json({ profile: safeProfile, shows, tracks }, { headers: { 'Cache-Control': 'private, no-store' } });
}

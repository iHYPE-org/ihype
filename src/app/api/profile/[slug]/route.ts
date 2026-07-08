import { NextResponse } from 'next/server';
import type { ShowStatus } from '@prisma/client';
import { db } from '@/lib/db';
import { getDemoCreatorExclusion, isDemoUser, shouldHideDemoContent } from '@/lib/runtime-flags';

export const revalidate = 300; // 5-minute cache for public profile data

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
      avatarImage: true,
      heroImage: true,
      logoImage: true,
      galleryImage: true,
      featureVideoUrl: true,
      parkingDetails: true,
      fanShareEnabled: true,
      createdAt: true,
      owner: { select: { email: true, username: true } }
    }
  });

  if (!profile || (shouldHideDemoContent() && isDemoUser(profile.owner))) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  const { owner: _owner, ...safeProfile } = profile;
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
          where: { profileId: profile.id, freeUseEnabled: true },
          orderBy: { createdAt: 'desc' },
          take: 12,
          select: { hexId: true, title: true, mimeType: true, notes: true, createdAt: true }
        })
      : Promise.resolve([])
  ]);

  return NextResponse.json({ profile: safeProfile, shows, tracks });
}

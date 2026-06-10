import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Daily discovery picks for the workbench: at most one upcoming show
// (preferring the user's city), one trending artist/DJ the user doesn't
// follow yet, and one recent free-use track. User-specific — never cached.
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

    // Derive the user's city from their own profiles (same source as
    // getWorkbenchData's primary-profile city).
    const ownProfiles = await db.profile.findMany({
      where: { ownerId: userId },
      select: { id: true, city: true },
    });
    const ownProfileIds = ownProfiles.map((p) => p.id);
    const city = ownProfiles.find((p) => p.city?.trim())?.city?.trim().toLowerCase() ?? null;

    const now = new Date();
    const inSevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [upcomingShows, followed, trendingProfiles, freeTracks] = await Promise.all([
      // Top-hyped SCHEDULED shows starting within 7 days; city preference
      // applied below via tag matching (same approach as /api/trending-local).
      db.show.findMany({
        where: {
          status: 'SCHEDULED',
          startsAt: { gte: now, lte: inSevenDays },
        },
        orderBy: { hypeCount: 'desc' },
        take: 5,
        select: { id: true, title: true, slug: true, startsAt: true, hypeCount: true, tags: true },
      }).catch(() => [] as { id: string; title: string; slug: string; startsAt: Date; hypeCount: number; tags: string[] }[]),
      // Profiles the user already follows
      db.follow.findMany({
        where: { followerId: userId },
        select: { followeeProfileId: true },
      }).catch(() => [] as { followeeProfileId: string }[]),
      // Trending artist/DJ profiles (same shape as getWorkbenchData trending)
      db.profile.findMany({
        where: { type: { in: ['ARTIST', 'DJ'] }, hypeCount: { gt: 0 }, fanShareEnabled: true },
        orderBy: { hypeCount: 'desc' },
        take: 5,
        select: { id: true, name: true, slug: true, city: true, genres: true, hypeCount: true, avatarImage: true, type: true },
      }).catch(() => [] as { id: string; name: string; slug: string; city: string | null; genres: string[]; hypeCount: number; avatarImage: string | null; type: string }[]),
      // Recent free-use tracks from other artists
      db.artistMediaAsset.findMany({
        where: {
          freeUseEnabled: true,
          isPublished: true,
          profileId: { notIn: ownProfileIds.length > 0 ? ownProfileIds : undefined },
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          id: true, hexId: true, title: true, createdAt: true,
          profile: { select: { name: true, slug: true, type: true } },
        },
      }).catch(() => [] as { id: string; hexId: string; title: string; createdAt: Date; profile: { name: string; slug: string; type: string } }[]),
    ]);

    // Show: prefer one tagged with the user's city, else top global
    const pickedShow = (city && upcomingShows.find((s) => s.tags.some((t) => t.toLowerCase() === city))) || upcomingShows[0] || null;

    // Profile: first trending profile the user neither follows nor owns
    const followedIds = new Set(followed.map((f) => f.followeeProfileId));
    const ownIds = new Set(ownProfileIds);
    const pickedProfile = trendingProfiles.find((p) => !followedIds.has(p.id) && !ownIds.has(p.id)) ?? null;

    const pickedTrack = freeTracks[0] ?? null;

    return NextResponse.json({
      show: pickedShow ? {
        id: pickedShow.id,
        title: pickedShow.title,
        slug: pickedShow.slug,
        startsAt: pickedShow.startsAt,
        hypeCount: pickedShow.hypeCount,
        isLocal: !!(city && pickedShow.tags.some((t) => t.toLowerCase() === city)),
      } : null,
      profile: pickedProfile ? {
        id: pickedProfile.id,
        name: pickedProfile.name,
        slug: pickedProfile.slug,
        type: pickedProfile.type,
        city: pickedProfile.city ?? '',
        genre: pickedProfile.genres[0] ?? '',
        hypeCount: pickedProfile.hypeCount,
        avatarImage: pickedProfile.avatarImage ?? '',
      } : null,
      track: pickedTrack ? {
        id: pickedTrack.id,
        hexId: pickedTrack.hexId,
        title: pickedTrack.title,
        artistName: pickedTrack.profile.name,
        artistPath: `/${pickedTrack.profile.type.toLowerCase()}s/${pickedTrack.profile.slug}`,
      } : null,
    });
  } catch (err) {
    console.error('[api/discover/daily] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

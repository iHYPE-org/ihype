import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const profileId = request.nextUrl.searchParams.get('profileId');
    if (!profileId) {
      return NextResponse.json({ error: 'profileId required' }, { status: 400 });
    }

    // Get fan IDs who hyped this profile
    const fans = await db.profileHypeEvent.findMany({
      where: { profileId },
      select: { userId: true },
    });

    if (fans.length === 0) {
      return NextResponse.json({ matches: [] });
    }

    const fanIds = fans.map((f) => f.userId);

    // Find other profiles these fans also hyped (excluding the source profile)
    const overlap = await db.profileHypeEvent.groupBy({
      by: ['profileId'],
      where: {
        userId: { in: fanIds },
        profileId: { not: profileId },
        profile: { type: { in: ['ARTIST', 'DJ'] } },
      },
      _count: { userId: true },
      orderBy: { _count: { userId: 'desc' } },
      take: 5,
    });

    if (overlap.length === 0) {
      return NextResponse.json({ matches: [] });
    }

    const profiles = await db.profile.findMany({
      where: { id: { in: overlap.map((o) => o.profileId) } },
      select: { id: true, slug: true, name: true, genres: true, city: true, avatarImage: true, hypeCount: true },
    });

    const profileMap = new Map(profiles.map((p) => [p.id, p]));

    const matches = overlap
      .map((o) => {
        const profile = profileMap.get(o.profileId);
        if (!profile) return null;
        return { ...profile, sharedFans: o._count.userId };
      })
      .filter(Boolean);

    return NextResponse.json({ matches });
  } catch (err) {
    console.error('[api/shows/match-artists] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

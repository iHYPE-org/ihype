import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ artists: [], venues: [], djs: [] });
    }

    // Get profileIds the user has already hyped
    const hyped = await db.profileHypeEvent.findMany({
      where: { userId: session.user.id },
      select: { profileId: true },
    });
    const hypedIds = new Set(hyped.map(h => h.profileId));

    // Get profiles owned by the user (exclude self)
    const ownProfiles = await db.profile.findMany({
      where: { ownerId: session.user.id },
      select: { id: true },
    });
    const ownIds = new Set(ownProfiles.map(p => p.id));

    const excludeIds = [...hypedIds, ...ownIds];

    const profiles = await db.profile.findMany({
      where: {
        id: { notIn: excludeIds.length > 0 ? excludeIds : undefined },
      },
      orderBy: { hypeCount: 'desc' },
      take: 60,
      select: {
        id: true,
        slug: true,
        name: true,
        type: true,
        city: true,
        stateRegion: true,
        hypeCount: true,
        genres: true,
        avatarImage: true,
      },
    });

    const artists = profiles
      .filter(p => p.type === 'ARTIST')
      .slice(0, 20)
      .map(p => ({
        id: p.id,
        slug: p.slug,
        name: p.name,
        city: p.city,
        stateRegion: p.stateRegion,
        hypeCount: p.hypeCount,
        genres: p.genres,
        avatarImage: p.avatarImage,
      }));

    const venues = profiles
      .filter(p => p.type === 'VENUE')
      .slice(0, 20)
      .map(p => ({
        id: p.id,
        slug: p.slug,
        name: p.name,
        city: p.city,
        stateRegion: p.stateRegion,
        hypeCount: p.hypeCount,
        genres: p.genres,
        avatarImage: p.avatarImage,
      }));

    const djs = profiles
      .filter(p => p.type === 'DJ')
      .slice(0, 20)
      .map(p => ({
        id: p.id,
        slug: p.slug,
        name: p.name,
        city: p.city,
        stateRegion: p.stateRegion,
        hypeCount: p.hypeCount,
        genres: p.genres,
        avatarImage: p.avatarImage,
      }));

    return NextResponse.json({ artists, venues, djs });
  } catch (err) {
    console.error('[api/discover] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

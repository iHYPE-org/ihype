import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ seeds: [] });

  const url = new URL(request.url);
  const genreParam = url.searchParams.get('genres') ?? '';
  const genres = genreParam
    .split(',')
    .map((g) => g.trim())
    .filter((g) => g.length > 0);

  try {
    const skipped = await db.seed.findMany({
      where: { userId: session.user.id, action: 'skip' },
      select: { mediaId: true },
    });
    const skipIds = new Set(skipped.map(s => s.mediaId));

    // --- Collaborative filtering (v2) -----------------------------------
    // Find profiles current user has hyped (A), then users who also hyped
    // any of A (B), then profiles those users hyped that A has not (C).
    let cfMedia: Array<{ id: string; title: string; profile: { name: string; genres: string[] } | null }> = [];
    if (genres.length === 0) {
      const hypedByMe = await db.profileHypeEvent.findMany({
        where: { userId: session.user.id },
        select: { profileId: true },
        take: 100
      });
      const myProfileIds = hypedByMe.map((r) => r.profileId);
      if (myProfileIds.length > 0) {
        const fellowFans = await db.profileHypeEvent.findMany({
          where: { profileId: { in: myProfileIds }, userId: { not: session.user.id } },
          select: { userId: true },
          distinct: ['userId'],
          take: 500
        });
        const fanIds = fellowFans.map((r) => r.userId);
        if (fanIds.length > 0) {
          const mySet = new Set(myProfileIds);
          const overlap = await db.profileHypeEvent.findMany({
            where: { userId: { in: fanIds }, profileId: { notIn: myProfileIds } },
            select: { profileId: true },
            take: 1000
          });
          const counts = new Map<string, number>();
          for (const row of overlap) {
            if (mySet.has(row.profileId)) continue;
            counts.set(row.profileId, (counts.get(row.profileId) ?? 0) + 1);
          }
          const rankedProfileIds = [...counts.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 50)
            .map(([pid]) => pid);
          if (rankedProfileIds.length > 0) {
            cfMedia = await db.artistMediaAsset.findMany({
              where: {
                profileId: { in: rankedProfileIds },
                id: { notIn: [...skipIds] }
              },
              take: 20,
              orderBy: { createdAt: 'desc' },
              select: {
                id: true,
                title: true,
                profile: { select: { name: true, genres: true } }
              }
            });
          }
        }
      }
    }

    const media = cfMedia.length
      ? cfMedia
      : await db.artistMediaAsset.findMany({
          where: {
            id: { notIn: [...skipIds] },
            ...(genres.length > 0
              ? { profile: { genres: { hasSome: genres } } }
              : {})
          },
          take: 20,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            title: true,
            profile: { select: { name: true, genres: true } }
          },
        });

    return NextResponse.json({
      seeds: media.map(m => ({
        id: m.id,
        trackId: m.id,
        title: m.title,
        artistName: m.profile?.name ?? 'Unknown Artist',
        genres: m.profile?.genres ?? [],
        reason: genres.length
          ? `Matches ${genres.join(', ')}`
          : cfMedia.length
            ? 'Fans like you also hype this'
            : 'Recommended based on your hypes',
      })),
    });
  } catch (error) {
    console.error('[discover/seeds] failed to load seeds', error);
    return NextResponse.json({ error: 'Could not load seeds.' }, { status: 500 });
  }
}

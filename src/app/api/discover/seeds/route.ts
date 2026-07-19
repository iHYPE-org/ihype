import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { log } from '@/lib/logger';

const LAMBDA = 0.05;

function decayWeight(createdAt: Date): number {
  const daysSince = (Date.now() - createdAt.getTime()) / 86_400_000;
  return Math.exp(-LAMBDA * daysSince);
}

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
    const actioned = await db.seed.findMany({
      where: { userId: session.user.id, action: { in: ['skip', 'save', 'hype'] } },
      select: { mediaId: true },
    });
    const actionedIds = new Set(actioned.map(s => s.mediaId));

    // --- Collaborative filtering (v2) with time-decay scoring --------
    let cfMedia: Array<{ id: string; title: string; profile: { name: string; genres: string[]; nowPlaying: string | null; journalContent: string | null } | null }> = [];
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
          // Use findMany to get createdAt for decay weighting
          const overlap = await db.profileHypeEvent.findMany({
            where: { userId: { in: fanIds }, profileId: { notIn: myProfileIds } },
            select: { profileId: true, createdAt: true },
            take: 1000
          });
          const scores = new Map<string, number>();
          for (const row of overlap) {
            if (mySet.has(row.profileId)) continue;
            const w = decayWeight(row.createdAt);
            scores.set(row.profileId, (scores.get(row.profileId) ?? 0) + w);
          }
          const rankedProfileIds = [...scores.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 50)
            .map(([pid]) => pid);
          if (rankedProfileIds.length > 0) {
            cfMedia = await db.artistMediaAsset.findMany({
              where: {
                profileId: { in: rankedProfileIds },
                id: { notIn: [...actionedIds] },
                profile: { discoverable: true }
              },
              take: 20,
              orderBy: { createdAt: 'desc' },
              select: {
                id: true,
                title: true,
                profile: { select: { name: true, genres: true, nowPlaying: true, journalContent: true } }
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
            id: { notIn: [...actionedIds] },
            profile: genres.length > 0 ? { genres: { hasSome: genres }, discoverable: true } : { discoverable: true }
          },
          take: 20,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            title: true,
            profile: { select: { name: true, genres: true, nowPlaying: true, journalContent: true } }
          },
        });

    // Hype count per track — use findMany for per-record decay weights
    const mediaIds = media.map(m => m.id);
    const hypeSeeds = mediaIds.length > 0
      ? await db.seed.findMany({
          where: { mediaId: { in: mediaIds }, action: 'hype' },
          select: { mediaId: true, createdAt: true },
        }).catch(() => [] as { mediaId: string; createdAt: Date }[])
      : [];
    const hypeScoreMap = new Map<string, number>();
    for (const row of hypeSeeds) {
      const w = decayWeight(row.createdAt);
      hypeScoreMap.set(row.mediaId, (hypeScoreMap.get(row.mediaId) ?? 0) + w);
    }
    // Raw count for display
    const hypeCountMap = new Map<string, number>();
    for (const row of hypeSeeds) {
      hypeCountMap.set(row.mediaId, (hypeCountMap.get(row.mediaId) ?? 0) + 1);
    }

    return NextResponse.json({
      seeds: media.map(m => ({
        id: m.id,
        trackId: m.id,
        title: m.title,
        artistName: m.profile?.name ?? 'Unknown Artist',
        genres: m.profile?.genres ?? [],
        hypeCount: hypeCountMap.get(m.id) ?? 0,
        nowPlaying: m.profile?.nowPlaying ?? null,
        journalContent: m.profile?.journalContent ?? null,
        reason: genres.length
          ? `Matches ${genres.join(', ')}`
          : cfMedia.length
            ? 'Fans like you also hype this'
            : 'Recommended based on your hypes',
      })),
    });
  } catch (error) {
    log.error('[discover/seeds]', error instanceof Error ? error : null, 'Failed to load seeds');
    return NextResponse.json({ error: 'Could not load seeds.' }, { status: 500 });
  }
}

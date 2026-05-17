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

    const media = await db.artistMediaAsset.findMany({
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
          : 'Recommended based on your hypes',
      })),
    });
  } catch (error) {
    console.error('[discover/seeds] failed to load seeds', error);
    return NextResponse.json({ error: 'Could not load seeds.' }, { status: 500 });
  }
}

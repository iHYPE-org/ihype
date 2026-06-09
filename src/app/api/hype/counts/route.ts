import { NextRequest, NextResponse } from 'next/server';
import { db, withDbRetry } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const trackParam = searchParams.get('trackIds');
    const showParam = searchParams.get('showIds');

    const trackIds = trackParam ? trackParam.split(',').filter(Boolean) : [];
    const showIds = showParam ? showParam.split(',').filter(Boolean) : [];

    const shows: { id: string; hypeCount: number }[] = showIds.length > 0
      ? await withDbRetry(() =>
          db.show.findMany({
            where: { id: { in: showIds } },
            select: { id: true, hypeCount: true },
          })
        )
      : [];

    const showCounts: Record<string, number> = {};
    for (const s of shows) {
      showCounts[s.id] = s.hypeCount;
    }

    // ArtistMediaAsset has no hypeCount field — return zero for all track IDs
    const trackCounts: Record<string, number> = {};
    for (const id of trackIds) {
      trackCounts[id] = 0;
    }

    return NextResponse.json({ tracks: trackCounts, shows: showCounts });
  } catch (err) {
    console.error('[api/hype/counts] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

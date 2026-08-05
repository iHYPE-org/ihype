import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { log } from '@/lib/logger';
import { findStation, stationWhere, type StationContext } from '@/lib/stations';
import { isRadioEnabledRuntime } from '@/lib/runtime-flags';

export const dynamic = 'force-dynamic';

const MAX_LIMIT = 50;

export type StationTrack = {
  id: string;
  hexId: string;
  title: string;
  artistName: string;
  artistSlug: string;
  artworkUrl: string | null;
  mediaUrl: string | null;
  durationSecs: number | null;
};

/**
 * `GET /api/stations/:slug/tracks?limit&cursor` — one station resolved to a
 * playable list (§5's `GET /v1/stations/:slug/tracks`).
 *
 * Cursor pagination on `id` rather than an offset: a station is recomputed on
 * every request, so an offset would skip or repeat rows as the underlying set
 * shifts under the reader.
 */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    if (!(await isRadioEnabledRuntime())) {
      return NextResponse.json(
        { error: 'Radio is temporarily paused.', code: 'RADIO_PAUSED' },
        { status: 503, headers: { 'Retry-After': '300' } },
      );
    }
    const { slug } = await params;
    const station = findStation(slug);
    if (!station) return NextResponse.json({ error: 'Unknown station.' }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const requestedLimit = Number(searchParams.get('limit'));
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.min(Math.trunc(requestedLimit), MAX_LIMIT)
      : 20;
    const cursor = searchParams.get('cursor');

    const session = await auth().catch(() => null);
    const userId = session?.user?.id ?? null;
    const [hypes, follows, viewerProfile] = await Promise.all([
      userId ? db.profileHypeEvent.findMany({ where: { userId }, select: { profileId: true }, take: 200 }) : Promise.resolve([]),
      userId ? db.follow.findMany({ where: { followerId: userId }, select: { followeeProfileId: true }, take: 200 }) : Promise.resolve([]),
      userId ? db.profile.findFirst({ where: { ownerId: userId, city: { not: null } }, select: { city: true } }) : Promise.resolve(null),
    ]);

    const context: StationContext = {
      hypedProfileIds: hypes.map((hype) => hype.profileId),
      followedProfileIds: follows.map((follow) => follow.followeeProfileId),
      viewerCity: viewerProfile?.city ?? null,
      now: new Date(),
    };

    const rows = await db.artistMediaAsset.findMany({
      where: stationWhere(station, context),
      // `new` is the one station whose whole premise is recency; the rest lead
      // with the artist's hype so a station opens on its strongest track.
      orderBy: station.kind === 'new'
        ? [{ createdAt: 'desc' }, { id: 'asc' }]
        : [{ profile: { hypeCount: 'desc' } }, { id: 'asc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true, hexId: true, title: true, storageUrl: true, artworkUrl: true, durationSecs: true,
        profile: { select: { name: true, slug: true } },
      },
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const tracks: StationTrack[] = page.map((row) => ({
      id: row.id,
      hexId: row.hexId,
      title: row.title,
      artistName: row.profile.name,
      artistSlug: row.profile.slug,
      artworkUrl: row.artworkUrl,
      mediaUrl: row.storageUrl,
      durationSecs: row.durationSecs,
    }));

    return NextResponse.json(
      {
        station: { slug: station.slug, kind: station.kind, title: station.title, subtitle: station.subtitle },
        tracks,
        nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    log.error('[api/stations/tracks]', error instanceof Error ? error : { error: String(error) }, 'error');
    return NextResponse.json({ error: 'Station tracks are temporarily unavailable.' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { log } from '@/lib/logger';
import { STATIONS, stationTitle, stationWhere, type StationContext } from '@/lib/stations';
import { isRadioEnabledRuntime } from '@/lib/runtime-flags';

export const dynamic = 'force-dynamic';

export type StationSummary = {
  slug: string;
  kind: string;
  title: string;
  subtitle: string;
  genre: string | null;
  /** Real resolved count. Null when the count could not be read — the row then
   *  renders without a count rather than claiming zero tracks. */
  trackCount: number | null;
};

/**
 * `GET /api/stations` — the eight computed stations, with a real resolved track
 * count each (`BACKEND_REWRITE.md` §5's `GET /v1/stations`).
 *
 * Counts are resolved per station and each is independently caught, following
 * the same rule as the admin workbench: one failing query must not make the
 * whole board read "nothing here". A station whose count is unknown returns
 * null, and the UI omits the count rather than rendering "0 tracks" beside a
 * station that may be full.
 */
export async function GET() {
  try {
    if (!(await isRadioEnabledRuntime())) {
      return NextResponse.json(
        { error: 'Radio is temporarily paused.', code: 'RADIO_PAUSED' },
        { status: 503, headers: { 'Retry-After': '300' } },
      );
    }
    const session = await auth().catch(() => null);
    const userId = session?.user?.id ?? null;

    const [hypes, follows, viewerProfile] = await Promise.all([
      userId
        ? db.profileHypeEvent.findMany({ where: { userId }, select: { profileId: true }, take: 200 }).catch(() => [])
        : Promise.resolve([]),
      userId
        ? db.follow.findMany({ where: { followerId: userId }, select: { followeeProfileId: true }, take: 200 }).catch(() => [])
        : Promise.resolve([]),
      userId
        ? db.profile.findFirst({ where: { ownerId: userId, city: { not: null } }, select: { city: true } }).catch(() => null)
        : Promise.resolve(null),
    ]);

    const context: StationContext = {
      hypedProfileIds: hypes.map((hype) => hype.profileId),
      followedProfileIds: follows.map((follow) => follow.followeeProfileId),
      viewerCity: viewerProfile?.city ?? null,
      now: new Date(),
    };

    const stations: StationSummary[] = await Promise.all(STATIONS.map(async (station) => ({
      slug: station.slug,
      kind: station.kind,
      title: stationTitle(station, context.viewerCity),
      subtitle: station.subtitle,
      genre: station.genre,
      trackCount: await db.artistMediaAsset
        .count({ where: stationWhere(station, context) })
        .catch((error) => {
          log.error('[api/stations] count failed', { station: station.slug, error: String(error) }, 'error');
          return null;
        }),
    })));

    return NextResponse.json({ stations }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    log.error('[api/stations]', error instanceof Error ? error : { error: String(error) }, 'error');
    return NextResponse.json({ error: 'Stations are temporarily unavailable.' }, { status: 500 });
  }
}

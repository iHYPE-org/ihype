import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { log } from '@/lib/logger';
import { findStation, stationWhere, type StationContext } from '@/lib/stations';
import { isRadioEnabledRuntime } from '@/lib/runtime-flags';
import { loadRequestSignals } from '@/lib/request-signals';
import { resolveWeightedAdBreakClips } from '@/lib/ad-clip-selection';
import { interleaveStationAds, type StationItemLike } from '@/lib/station-breaks';

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
  /**
   * Set only on an AD slot, and only for a real purchased spot (`mkt_<Ad.id>`).
   * The player bills the advertiser off this: see `GlobalMediaPlayer`.
   *
   * This is what makes a paid campaign audible. Until 2026-09-03 the ad
   * interleaving lived only behind `getStationState()` → `GET /api/radio/station`,
   * and NOTHING called that route — `src/app/radio` was deleted with the show
   * creator, and the Music shell has always read THIS endpoint, which returned
   * tracks and nothing else. So an advertiser could pass vetting, pay, and have
   * their spot played by nobody. Measured by the acceptance walk: an APPROVED
   * campaign, a station serving 0 breaks.
   */
  adClipId?: string;
  /** Why this track is in this station, for the viewer. Derived from the
   *  context the station was already resolved with, so it costs no extra
   *  query — see `reasonFor` below. */
  reason: string;
};

/**
 * The explanation a listener is owed for a recommendation (owner, 2026-08-25:
 * "Recommended needs reason why rec was made").
 *
 * Derived rather than stored, and derived from the SAME context the station's
 * `where` was built from — so it cannot disagree with why the row is actually
 * in the list. The follow and hype checks come first because they are the
 * specific answer; the station's kind is the fallback for a row that qualified
 * some other way.
 */
function reasonFor(
  profileId: string,
  city: string | null,
  station: { kind: string; genre: string | null },
  context: StationContext,
): string {
  if (context.followedProfileIds.includes(profileId)) return 'From an artist you follow';
  if (context.hypedProfileIds.includes(profileId)) return 'From an artist you hyped';
  if (context.requestedProfileIds.includes(profileId)) return 'You asked a venue to book them';
  const wanted = context.wantedAtVenue.find((entry) => entry.profileId === profileId);
  if (wanted) return wanted.venueName ? `Fans want them at ${wanted.venueName}` : 'Fans want them at a venue you follow';
  switch (station.kind) {
    case 'local': return city ? `Playing in ${city}` : 'Near you';
    case 'new': return 'Uploaded this week';
    case 'genre': return station.genre ? `${station.genre} station` : 'Genre station';
    case 'for_you': return 'Matches what you replay';
    case 'friends': return 'Shared by someone you follow';
    default: return station.kind === 'friends' ? 'Shared by someone you follow' : 'In this station';
  }
}

/**
 * Mixes real ad breaks into one page of a station, using the SAME placement
 * rules the always-on station has always used (`interleaveStationAds`: never
 * first, never last, and never zero breaks on a rotation long enough to hold
 * one). Sharing that helper is the point — two placement policies would drift.
 *
 * **Real spots only.** `resolveWeightedAdBreakClips()` falls back to the
 * built-in placeholder catalogue (`0x…` clip ids) when no campaign has
 * inventory, which is the right fail-soft for a fixture and the wrong one for
 * a listener: a member would hear "Local spot A" and no advertiser would be
 * billed. No inventory therefore means no break.
 *
 * Failure is silent by design: an ad lookup that throws must not take the
 * station down. A station with no ads still plays.
 */
async function withAdBreaks(tracks: StationTrack[]): Promise<StationTrack[]> {
  if (tracks.length < 2) return tracks;
  const clips = (await resolveWeightedAdBreakClips().catch(() => []))
    .filter((clip) => clip.clipId.startsWith('mkt_'));
  if (!clips.length) return tracks;

  /* A track with no stored audio keeps its place (the client drops it) but
     contributes no time, so it cannot pull a break forward. */
  const items: StationItemLike[] = tracks.map((track) => ({
    hexId: track.hexId,
    title: track.title,
    url: track.mediaUrl ?? '',
    artistName: track.artistName,
    artistSlug: track.artistSlug,
    artworkUrl: track.artworkUrl,
    durationSecs: track.mediaUrl ? track.durationSecs ?? 0 : 0,
  }));

  const byHexId = new Map(tracks.map((track) => [track.hexId, track]));
  return interleaveStationAds(items, clips).map((item) => {
    if (!item.adClipId) return byHexId.get(item.hexId) ?? null;
    return {
      id: item.adClipId,
      hexId: item.adClipId,
      title: item.title,
      artistName: item.artistName,
      artistSlug: '',
      artworkUrl: null,
      mediaUrl: item.url,
      durationSecs: item.durationSecs,
      adClipId: item.adClipId,
      reason: 'Advertisement',
    } satisfies StationTrack;
  }).filter((track): track is StationTrack => track !== null);
}

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

    const followedProfileIds = follows.map((follow) => follow.followeeProfileId);
    /* Fan requests as a station signal — see `fan-demand.ts`. Read after the
       follows because the venues the viewer follows are one of its inputs. */
    const requests = userId
      ? await loadRequestSignals(userId, followedProfileIds)
      : { requestedArtistIds: [], requestedVenueIds: [], wantedAt: [] };

    const context: StationContext = {
      hypedProfileIds: hypes.map((hype) => hype.profileId),
      followedProfileIds,
      requestedProfileIds: requests.requestedArtistIds,
      wantedAtVenue: requests.wantedAt.map((entry) => ({ profileId: entry.artistProfileId, venueName: entry.venueName })),
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
        profileId: true,
        album: { select: { artworkUrl: true } },
        profile: { select: { name: true, slug: true, city: true } },
      },
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const musicOnly: StationTrack[] = page.map((row) => ({
      id: row.id,
      hexId: row.hexId,
      title: row.title,
      artistName: row.profile.name,
      artistSlug: row.profile.slug,
      // Per track, else the album's — the artist's choice of which to give.
      artworkUrl: row.artworkUrl ?? row.album?.artworkUrl ?? null,
      mediaUrl: row.storageUrl,
      durationSecs: row.durationSecs,
      reason: reasonFor(row.profileId, row.profile.city, station, context),
    }));

    /* The cursor is the last MUSIC row, resolved before any ad is mixed in:
       an ad slot is not a database row and must never become a page cursor. */
    const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null;

    const tracks = await withAdBreaks(musicOnly);

    return NextResponse.json(
      {
        station: { slug: station.slug, kind: station.kind, title: station.title, subtitle: station.subtitle },
        tracks,
        nextCursor,
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    log.error('[api/stations/tracks]', error instanceof Error ? error : { error: String(error) }, 'error');
    return NextResponse.json({ error: 'Station tracks are temporarily unavailable.' }, { status: 500 });
  }
}

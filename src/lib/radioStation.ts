import { db } from '@/lib/db';
import { getDemoOwnerExclusion } from '@/lib/runtime-flags';
import { stationPositionAt } from '@/lib/growth-util';
import { resolveWeightedAdBreakClips } from '@/lib/ad-clip-selection';
import { interleaveStationAds } from '@/lib/station-breaks';
import { releasedMediaWhere } from '@/lib/media-release';

export type StationTrack = {
  hexId: string;
  title: string;
  url: string;
  artistName: string;
  artistSlug: string;
  artworkUrl: string | null;
  durationSecs: number;
  /**
   * Set only on ad slots. `mkt_<Ad.id>` is a purchased marketplace spot and
   * reports an impression when it plays; `0x…` is house filler from
   * `builtInAdClips` and bills nobody. Absent on music.
   */
  adClipId?: string;
};

export type StationState = {
  live: boolean;                 // a real DJ show is broadcasting now
  liveShow: { slug: string; title: string } | null;
  nowPlaying: StationTrack | null;
  positionSecs: number;          // how far into nowPlaying the station is
  upNext: StationTrack[];        // the next few tracks in rotation
  rotationLength: number;        // total tracks in the auto-DJ rotation
};

// Fallback when a free-use track has no stored duration.
const NOMINAL_DURATION = 210;
const ROTATION_SIZE = 40;

/**
 * The always-on auto-DJ station. The free-use crate plays on a continuous,
 * deterministic loop seeded by server time, so every listener hears the same
 * track at the same offset — the station is never silent, even with no live
 * DJ. If a DJ show is actually LIVE, that takes precedence (live === true).
 */
export async function getStationState(now: Date = new Date()): Promise<StationState> {
  const [liveShow, rows] = await Promise.all([
    db.show.findFirst({
      where: { isRadioShow: true, status: 'LIVE' },
      orderBy: { startsAt: 'desc' },
      select: { slug: true, title: true },
    }).catch(() => null),
    db.artistMediaAsset.findMany({
      where: {
        // `freeUseEnabled` alone is not an eligibility rule, it is a consent
        // flag. Uploads are vetted (`runTrackScanPipeline`) and a flagged one
        // never reaches the crate — `/api/artist-media` sets
        // `effectiveFreeUse = freeUseEnabled && vetting.cleared` — but consent
        // and clearance say nothing about whether the artist has RELEASED the
        // track.
        //
        // Without `releasedMediaWhere()` this station aired unpublished drafts
        // and, worse, tracks scheduled for a future `publishAt` — putting a
        // record on the radio before its release date. The computed stations
        // (`src/lib/stations.ts`) have always applied this rule; the always-on
        // station predates them and never did.
        ...releasedMediaWhere(now),
        freeUseEnabled: true,
        profile: { ...getDemoOwnerExclusion(), type: 'ARTIST' },
      },
      orderBy: { profile: { hypeCount: 'desc' } },
      take: ROTATION_SIZE,
      select: {
        hexId: true, title: true, durationSecs: true,
        profile: { select: { name: true, slug: true, avatarImage: true } },
      },
    }).catch(() => [] as Array<{
      hexId: string; title: string; durationSecs: number | null;
      profile: { name: string; slug: string; avatarImage: string | null };
    }>),
  ]);

  const rotation: StationTrack[] = rows.map((t: {
    hexId: string; title: string; durationSecs: number | null;
    profile: { name: string; slug: string; avatarImage: string | null };
  }) => ({
    hexId: t.hexId,
    title: t.title,
    url: `/api/media/${t.hexId}`,
    artistName: t.profile.name,
    artistSlug: t.profile.slug,
    artworkUrl: t.profile.avatarImage ?? null,
    durationSecs: t.durationSecs && t.durationSecs > 0 ? t.durationSecs : NOMINAL_DURATION,
  }));

  if (rotation.length === 0) {
    return {
      live: !!liveShow,
      liveShow: liveShow ?? null,
      nowPlaying: null,
      positionSecs: 0,
      upNext: [],
      rotationLength: 0,
    };
  }

  // Advertising. Until now the only place a purchased spot could air was
  // inside a manually authored show, which is no longer part of radio
  // (docs/dj-role-removal-scope.md) — so without this, self-serve campaigns
  // holding real pre-authorised Stripe funds would have nowhere left to run.
  //
  // A break is a MIXTURE of scopes, weighted local-most to global-least — see
  // `ad-scope-mix.ts`. It used to ask for 'national' and nothing else, which
  // meant a local advertiser's spot could never air at all: the cheapest tier,
  // and the one a venue down the road is most likely to buy.
  //
  // "Local" still means the platform's market rather than the individual
  // listener's, because this is one rotation positioned off the wall clock and
  // shared by everyone. That limit is written up on the resolver.
  //
  // Fails open on purpose. A break that cannot be resolved must never take the
  // music down with it — the station being silent is a worse outcome than the
  // station being unmonetised for one request.
  const adClips = await resolveWeightedAdBreakClips().catch(() => []);
  const sequence = interleaveStationAds(rotation, adClips);

  const { index, offset } = stationPositionAt(
    sequence.map((t) => t.durationSecs),
    Math.floor(now.getTime() / 1000),
  );

  const upNext = [1, 2, 3].map((n) => sequence[(index + n) % sequence.length]);

  return {
    live: !!liveShow,
    liveShow: liveShow ?? null,
    nowPlaying: sequence[index],
    positionSecs: offset,
    upNext,
    // The music count, not the sequence length — this is surfaced as "N
    // tracks in rotation" and counting ad breaks in it would be a lie.
    rotationLength: rotation.length,
  };
}

import type { ShowAdClip } from '@/lib/show-composer';

/**
 * Ad breaks for the always-on station.
 *
 * ## Why this exists
 *
 * Advertising used to air in exactly one place: a DJ's radio show.
 * `show-composer`'s `buildResolvedSequence()` injected AD items into a
 * `productionPlan`, and `ShowSequencePlayer` firing `POST /api/ads/impression`
 * is what actually spends an advertiser's budget. The DJ role is being removed
 * (`docs/dj-role-removal-scope.md`), which would leave self-serve campaigns —
 * holding real pre-authorised Stripe funds — with nowhere to run.
 *
 * **Ad revenue is the platform's only revenue.** The charter takes 0% of
 * ticket sales (70/20/10 to artist/venue/promoters), so this path is not a
 * secondary line — it is the line. That is why breaks are measured in wall
 * time and air on every rotation, rather than being suppressed whenever the
 * catalogue is thin. An unmonetised station is not a safe default here.
 *
 * ## The cadence is a balance, and both halves are load-bearing
 *
 * Two spots per quarter-hour keeps a not-for-profit running without becoming
 * the reason someone stops listening. Turn it up and the station stops being
 * worth having on; turn it off and there is nothing funding it. If this needs
 * revisiting, move `STATION_AD_INTERVAL_SECS` — do not reach for it as the
 * first lever when revenue is short, because the listener side of that trade
 * has no meter on it.
 *
 * What makes the trade tolerable is that these are **music-only ads**, and
 * that is enforced upstream rather than trusted here: `AdvertiserCategory` is
 * LABEL / VENUE_PROMOTER / GEAR / TICKETING / MERCH / TOUR with no general
 * bucket, and `ad-vetting.ts`'s policy rejects "general brands, non-music tech
 * companies, lifestyle brands, food/drink brands, financial services, or
 * anything not directly serving the music community". This module airs only
 * `status: 'APPROVED'` spots (see `resolveAdBreakClips`), so it inherits that
 * screening — a listener hears a label or a venue, not a car advert. Do not
 * add a path here that airs an unapproved clip; it would quietly undo the one
 * property that makes advertising on this station defensible.
 *
 * The always-on station is the natural home. It already plays continuously,
 * deterministically, to every listener; it simply had no advertising in it. An
 * ad slot is just another item in the rotation with a URL and a duration, so
 * `stationPositionAt()` keeps working unchanged and the client keeps playing
 * `url` without caring what kind of item it is.
 *
 * ## The shape choice
 *
 * An ad is a `StationTrack` with `adClipId` set, rather than a separate union
 * arm. That is deliberate: the rotation is fed to `stationPositionAt()` as a
 * list of durations, and every consumer already handles `StationTrack`. A
 * second arm would have meant touching all of it to gain nothing — the one
 * thing a caller must branch on is whether to report an impression, and
 * `adClipId` answers exactly that.
 *
 * A placeholder clip from `builtInAdClips` carries a `0x…` id and bills
 * nobody. Only `mkt_<Ad.id>` is a real purchased spot.
 */

export const MARKETPLACE_CLIP_PREFIX = 'mkt_';

/**
 * Roughly a quarter-hour of music between breaks, measured in real seconds
 * rather than in track counts — tracks run anywhere from ninety seconds to
 * eight minutes, so "every four tracks" would swing between five minutes and
 * half an hour and would not mean anything to a listener.
 */
export const STATION_AD_INTERVAL_SECS = 15 * 60;

/** A couple of spots per break, which is the ordinary radio shape. */
export const ADS_PER_BREAK = 2;

export type StationItemLike = {
  hexId: string;
  title: string;
  url: string;
  artistName: string;
  artistSlug: string;
  artworkUrl: string | null;
  durationSecs: number;
  /** Set only on ad slots. `mkt_<Ad.id>` bills; `0x…` is a placeholder. */
  adClipId?: string;
};

/** Fallback when a purchased spot has no stored duration. */
const NOMINAL_AD_DURATION = 30;

/** True when this item should report an impression, i.e. real money moves. */
export function isBillableAd(item: Pick<StationItemLike, 'adClipId'>): boolean {
  return typeof item.adClipId === 'string' && item.adClipId.startsWith(MARKETPLACE_CLIP_PREFIX);
}

/** `mkt_abc` → `abc`. Returns null for placeholders and non-ads. */
export function adIdFromClipId(clipId: string | undefined): string | null {
  if (!clipId || !clipId.startsWith(MARKETPLACE_CLIP_PREFIX)) return null;
  const id = clipId.slice(MARKETPLACE_CLIP_PREFIX.length);
  return id.length ? id : null;
}

function clipToItem(clip: ShowAdClip): StationItemLike {
  return {
    hexId: clip.clipId,
    title: clip.title,
    url: clip.url,
    artistName: 'Advertisement',
    artistSlug: '',
    artworkUrl: null,
    durationSecs: clip.durationSeconds && clip.durationSeconds > 0 ? clip.durationSeconds : NOMINAL_AD_DURATION,
    adClipId: clip.clipId,
  };
}

/**
 * Interleaves ad breaks into a station rotation.
 *
 * A break of `ADS_PER_BREAK` spots goes in once about `intervalSecs` of music
 * has played since the last one. Three rules shape where they land, each
 * avoiding a specific bad outcome:
 *
 *  - **Never first.** A station that opens on an ad is one nobody listens to.
 *  - **Never last.** The rotation loops, so a trailing break would butt
 *    against the leading track of the next pass — the listener would hear one
 *    break run straight into the next at the seam.
 *  - **Never zero breaks on a rotation long enough to hold one.** If the whole
 *    pass is shorter than the interval, a break still goes before the final
 *    track, because a short catalogue must not mean an unpaid station. This is
 *    the rule that makes ads air "regardless": the only rotation with no
 *    advertising is one with fewer than two tracks, where there is no interior
 *    position for a break to occupy.
 *
 * Clips cycle, so a single purchased spot does not take every slot when
 * several are eligible.
 */
export function interleaveStationAds(
  tracks: StationItemLike[],
  clips: ShowAdClip[],
  intervalSecs: number = STATION_AD_INTERVAL_SECS,
  adsPerBreak: number = ADS_PER_BREAK,
): StationItemLike[] {
  if (!clips.length) return tracks;
  if (tracks.length < 2) return tracks;
  if (!Number.isFinite(intervalSecs) || intervalSecs <= 0) return tracks;
  if (!Number.isFinite(adsPerBreak) || adsPerBreak < 1) return tracks;

  const out: StationItemLike[] = [];
  let clipIndex = 0;
  let sinceBreak = 0;
  let breaks = 0;

  const pushBreak = () => {
    for (let n = 0; n < adsPerBreak; n += 1) {
      out.push(clipToItem(clips[clipIndex % clips.length]));
      clipIndex += 1;
    }
    breaks += 1;
    sinceBreak = 0;
  };

  tracks.forEach((track, i) => {
    out.push(track);
    sinceBreak += Math.max(0, track.durationSecs);
    const isLast = i === tracks.length - 1;
    if (isLast) return;

    if (sinceBreak >= intervalSecs) {
      pushBreak();
      return;
    }
    // Last interior position on a rotation too short to have earned a break:
    // take it, so the station is never wholly unmonetised.
    if (breaks === 0 && i === tracks.length - 2) pushBreak();
  });

  return out;
}

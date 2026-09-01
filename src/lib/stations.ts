/**
 * Computed radio stations — the replacement for DJ-hosted radio shows.
 *
 * `BACKEND_REWRITE.md` §2: "Stations are **computed, not curated playlists.**
 * There is no join table of station→track. Each kind resolves at request
 * time." The eight stations and their subtitles are the handoff's own table.
 *
 * ## The one place this deliberately diverges from §2
 *
 * §2 says: `ALTER TABLE tracks RENAME COLUMN free_use TO radio_eligible`, and
 * "All resolutions filter on `tracks.radio_eligible = true`".
 *
 * In this codebase that is **not a rename**. `ArtistMediaAsset.freeUseEnabled`
 * defaults to `false` and means "I opt this track into the DJ free-use crate" —
 * an opt-IN, held by a small minority of tracks. §2 describes `radio_eligible`
 * as an opt-OUT ("`radio_eligible = false` excludes the track", "the artist
 * opt-out is preserved"), which is a default-true field. Filtering stations on
 * `freeUseEnabled: true` because the spec used the word "rename" would empty
 * every station on the platform while looking like it complied.
 *
 * So eligibility here is the codebase's existing radio rule — published,
 * released, and by a discoverable profile — which is already opt-out-shaped and
 * is what `/api/radio` has always used. Landing §2's actual field is a
 * migration plus a product decision about which consent applies; it is called
 * out in DESIGN_SYNC row 267 rather than guessed at here.
 *
 * Pure and dependency-light (no `@/lib/db`) so the catalog can be imported by
 * client components and tests.
 */

import type { Prisma } from '@prisma/client';
import { releasedMediaWhere } from '@/lib/media-release';

export const STATION_KINDS = ['for_you', 'local', 'new', 'friends', 'genre'] as const;
export type StationKind = (typeof STATION_KINDS)[number];

export type StationDefinition = {
  slug: string;
  kind: StationKind;
  title: string;
  subtitle: string;
  /** Non-null only when kind is 'genre'. */
  genre: string | null;
};

/**
 * The eight stations from the handoff's table, in its order. `local`'s title
 * carries a placeholder city that the resolver substitutes for the viewer's own
 * — the prototype hardcoded "Local · Portland".
 */
export const STATIONS: readonly StationDefinition[] = [
  { slug: 'for-you', kind: 'for_you', title: 'For you', subtitle: 'Built from what you hype and replay', genre: null },
  { slug: 'local', kind: 'local', title: 'Local', subtitle: 'Everything within 40 miles of you', genre: null },
  { slug: 'new', kind: 'new', title: 'New this week', subtitle: 'Fresh uploads across every genre', genre: null },
  { slug: 'friends', kind: 'friends', title: 'Recommended by friends', subtitle: 'Shared by accounts you follow', genre: null },
  { slug: 'dream-pop', kind: 'genre', title: 'Dream-pop', subtitle: 'Genre station', genre: 'Dream-pop' },
  { slug: 'punk', kind: 'genre', title: 'Punk', subtitle: 'Genre station', genre: 'Punk' },
  { slug: 'hip-hop', kind: 'genre', title: 'Hip-hop', subtitle: 'Genre station', genre: 'Hip-hop' },
  { slug: 'electronic', kind: 'genre', title: 'Electronic', subtitle: 'Genre station', genre: 'Electronic' },
];

export function findStation(slug: string): StationDefinition | null {
  return STATIONS.find((station) => station.slug === slug) ?? null;
}

/** How wide "local" is, per the handoff's own subtitle. */
export const LOCAL_RADIUS_MILES = 40;
export const NEW_WINDOW_DAYS = 7;

/**
 * Titles the `local` station for a viewer. A station whose subtitle promises
 * "within 40 miles of you" must not be titled "Local · Portland" for someone in
 * Chicago, and must not claim a city it does not know.
 */
export function stationTitle(station: StationDefinition, viewerCity: string | null | undefined): string {
  if (station.kind !== 'local') return station.title;
  const city = viewerCity?.trim();
  return city ? `Local · ${city}` : 'Local';
}

export type StationContext = {
  /** Profile ids the viewer has hyped — the taste signal for `for_you`. */
  hypedProfileIds: readonly string[];
  /** Profile ids the viewer follows — the signal for `friends`. */
  followedProfileIds: readonly string[];
  /**
   * Acts the viewer asked a venue to book (2026-09-01, `fan-demand.ts`). The
   * strongest taste signal a fan leaves, so `for_you` plays them.
   */
  requestedProfileIds: readonly string[];
  /**
   * Acts OTHER fans want at venues the viewer follows or asked, with the venue
   * to name in the reason. Feeds `for_you` and `friends`: the venue you follow
   * is an account you follow, and its fans wanting an act is what "recommended
   * by friends" means once a venue can be a friend.
   */
  wantedAtVenue: readonly { profileId: string; venueName: string }[];
  /** The viewer's own city label, for `local`. */
  viewerCity: string | null;
  now: Date;
};

/**
 * Builds the Prisma `where` that resolves one station at request time.
 *
 * Every kind is ANDed with the eligibility rule, so no station can serve an
 * unpublished, unreleased, or non-discoverable track regardless of its own
 * predicate. A kind with no signal to work from returns a clause that matches
 * nothing rather than silently falling back to "everything" — an empty For You
 * is honest, whereas For You quietly meaning New is not.
 */
export function stationWhere(
  station: StationDefinition,
  context: StationContext,
): Prisma.ArtistMediaAssetWhereInput {
  const eligible: Prisma.ArtistMediaAssetWhereInput = {
    ...releasedMediaWhere(context.now),
    profile: { discoverable: true },
  };

  const wantedIds = context.wantedAtVenue.map((entry) => entry.profileId);

  switch (station.kind) {
    case 'for_you': {
      const ids = [...new Set([...context.hypedProfileIds, ...context.requestedProfileIds, ...wantedIds])];
      return ids.length
        ? { AND: [eligible, { profileId: { in: ids } }] }
        : { AND: [eligible, { id: { in: [] } }] };
    }
    case 'friends': {
      const ids = [...new Set([...context.followedProfileIds, ...wantedIds])];
      return ids.length
        ? { AND: [eligible, { profileId: { in: ids } }] }
        : { AND: [eligible, { id: { in: [] } }] };
    }
    case 'local':
      return context.viewerCity
        ? { AND: [eligible, { profile: { discoverable: true, city: { equals: context.viewerCity, mode: 'insensitive' } } }] }
        : { AND: [eligible, { id: { in: [] } }] };
    case 'new':
      return {
        AND: [
          eligible,
          { createdAt: { gte: new Date(context.now.getTime() - NEW_WINDOW_DAYS * 24 * 60 * 60 * 1000) } },
        ],
      };
    case 'genre':
      return {
        AND: [
          eligible,
          { profile: { discoverable: true, genres: { has: station.genre! } } },
        ],
      };
  }
}

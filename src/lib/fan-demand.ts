/**
 * Fan demand — the analysis a venue's demand radar runs over the requests
 * fans have sent it (2026-09-01, owner: "Fans can request that venues bring
 * artists they recommend to perform at their venues. Those requests show up as
 * recommendations to the venues through analysis (time, frequency, location of
 * fan)").
 *
 * Pure, so it is unit-tested without a database: `venueBooking.ts` reads the
 * rows and hands them here. Three signals, each named by the owner:
 *
 *  - **time** — a request decays with a 30-day half-life. A fan who asked
 *    yesterday is a fan who is coming; one who asked last winter may have
 *    moved on. Nothing is ever dropped for age, it just weighs less.
 *  - **frequency** — DISTINCT fans, not raw requests. One fan asking five
 *    times is one ticket sale; only their strongest request counts toward the
 *    weight, and the raw count is kept beside it for the venue to see.
 *  - **location of fan** — a fan near the venue is a fan who can attend.
 *    Coordinates when both sides have them (Haversine, 40 km is "nearby",
 *    160 km "regional"), else city/state match, else unknown at a middle
 *    weight rather than zero — an unknown address is not evidence of distance.
 *
 * The grouping key is the artist PROFILE when the request names one, else the
 * normalised name. A request typed as "@handle" is resolved to a profile at
 * submission (`/api/venue-requests`), so name-only groups are acts not on
 * iHYPE — still shown to the venue, because "six fans want a band you have
 * never heard of" is exactly the signal the radar is for.
 *
 * **The same rows read from the artist's side** (owner, same day: "Fans can
 * also request artists come to venues near them or that they love and show
 * up as recommendations in artist analysis as well"): `scoreVenueDemand()`
 * groups one artist's requests by VENUE instead, with proximity still
 * measured fan-to-venue — a show is viable where the fans who asked can get
 * to, which is not necessarily where the artist lives. Same time and
 * frequency rules; one core, two groupings.
 */

export const HALF_LIFE_DAYS = 30;
export const NEARBY_KM = 40;
export const REGIONAL_KM = 160;

const DAY_MS = 86_400_000;

export type DemandRequest = {
  artistProfileId: string | null;
  artistName: string;
  requesterId: string;
  createdAt: Date;
  requesterCity: string | null;
  requesterStateRegion: string | null;
  requesterLatitude: number | null;
  requesterLongitude: number | null;
};

export type DemandVenue = {
  city: string | null;
  stateRegion: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type DemandEntry = {
  /** `profile:<id>` or `name:<normalised name>`. */
  key: string;
  artistProfileId: string | null;
  artistName: string;
  /** Distinct fans. The frequency signal. */
  fans: number;
  /** Raw requests, for display beside `fans`. */
  requests: number;
  /** Distinct fans within NEARBY_KM or in the venue's city. */
  nearby: number;
  latestAt: Date;
  /** Sum over fans of (recency × proximity) for that fan's strongest request. */
  weight: number;
};

/** 1 at the moment of the request, ½ after HALF_LIFE_DAYS, ¼ after twice that. */
export function recencyWeight(createdAt: Date, now: Date): number {
  const ageDays = (now.getTime() - createdAt.getTime()) / DAY_MS;
  if (!Number.isFinite(ageDays) || ageDays <= 0) return 1;
  return Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
}

function sameText(a: string | null, b: string | null): boolean {
  return Boolean(a && b && a.trim().toLowerCase() === b.trim().toLowerCase());
}

/**
 * How much a fan's location says about their attending. `nearby` is the
 * boolean the venue sees; `weight` is what the ranking uses.
 */
export function proximityWeight(
  request: Pick<DemandRequest, 'requesterCity' | 'requesterStateRegion' | 'requesterLatitude' | 'requesterLongitude'>,
  venue: DemandVenue,
): { weight: number; nearby: boolean } {
  const haveCoords =
    request.requesterLatitude !== null && request.requesterLongitude !== null &&
    venue.latitude !== null && venue.longitude !== null;
  if (haveCoords) {
    const km = haversineKm(request.requesterLatitude!, request.requesterLongitude!, venue.latitude!, venue.longitude!);
    if (km <= NEARBY_KM) return { weight: 1, nearby: true };
    if (km <= REGIONAL_KM) return { weight: 0.6, nearby: false };
    return { weight: 0.25, nearby: false };
  }
  if (sameText(request.requesterCity, venue.city)) return { weight: 1, nearby: true };
  if (sameText(request.requesterStateRegion, venue.stateRegion)) return { weight: 0.6, nearby: false };
  const fanKnown = Boolean(request.requesterCity || request.requesterStateRegion);
  const venueKnown = Boolean(venue.city || venue.stateRegion);
  // Both known and different is distance; either unknown is absence of
  // evidence, and weighs as the middle of the range rather than the bottom.
  if (fanKnown && venueKnown) return { weight: 0.25, nearby: false };
  return { weight: 0.4, nearby: false };
}

export function demandKey(request: Pick<DemandRequest, 'artistProfileId' | 'artistName'>): string {
  return request.artistProfileId ? `profile:${request.artistProfileId}` : `name:${request.artistName.trim().toLowerCase()}`;
}

/** One artist's requests, each carrying the venue it was addressed to. */
export type VenueDemandRequest = DemandRequest & {
  venueProfileId: string;
  venue: DemandVenue;
};

export type VenueDemandEntry = Omit<DemandEntry, 'artistProfileId' | 'artistName'> & {
  venueProfileId: string;
};

/**
 * The core: group requests by `keyOf`, weigh each by recency × proximity to
 * `venueOf(request)`, count distinct fans with one strongest ask each.
 */
function groupDemand<TRequest extends DemandRequest, TKey extends object>(
  requests: readonly TRequest[],
  keyOf: (request: TRequest) => string,
  venueOf: (request: TRequest) => DemandVenue,
  identityOf: (request: TRequest) => TKey,
  now: Date,
): (Omit<DemandEntry, 'artistProfileId' | 'artistName'> & TKey)[] {
  type Group = Omit<DemandEntry, 'artistProfileId' | 'artistName'> & TKey & { perFan: Map<string, { weight: number; nearby: boolean }> };
  const groups = new Map<string, Group>();

  for (const request of requests) {
    const key = keyOf(request);
    let group = groups.get(key);
    if (!group) {
      group = {
        ...identityOf(request),
        key,
        fans: 0,
        requests: 0,
        nearby: 0,
        latestAt: request.createdAt,
        weight: 0,
        perFan: new Map(),
      } as Group;
      groups.set(key, group);
    }
    group.requests += 1;
    if (request.createdAt > group.latestAt) group.latestAt = request.createdAt;

    const proximity = proximityWeight(request, venueOf(request));
    const weight = recencyWeight(request.createdAt, now) * proximity.weight;
    const best = group.perFan.get(request.requesterId);
    // One fan, however often they ask, is one fan: keep their strongest ask.
    if (!best || weight > best.weight) {
      group.perFan.set(request.requesterId, { weight, nearby: proximity.nearby || Boolean(best?.nearby) });
    } else if (proximity.nearby && !best.nearby) {
      best.nearby = true;
    }
  }

  type Entry = Omit<DemandEntry, 'artistProfileId' | 'artistName'> & TKey;
  const entries: Entry[] = [];
  for (const group of groups.values()) {
    let weight = 0;
    let nearby = 0;
    for (const fan of group.perFan.values()) {
      weight += fan.weight;
      if (fan.nearby) nearby += 1;
    }
    const { perFan, ...entry } = group;
    entries.push({ ...entry, fans: perFan.size, nearby, weight } as Entry);
  }

  return entries.sort(
    (a, b) => b.weight - a.weight || b.fans - a.fans || b.latestAt.getTime() - a.latestAt.getTime(),
  );
}

/** A venue's view: ranked acts, strongest first. Empty input → empty output. */
export function scoreFanDemand(requests: readonly DemandRequest[], venue: DemandVenue, now: Date = new Date()): DemandEntry[] {
  return groupDemand(
    requests,
    demandKey,
    () => venue,
    (request) => ({ artistProfileId: request.artistProfileId, artistName: request.artistName.trim() }),
    now,
  );
}

/**
 * An artist's view: ranked venues fans want them at, strongest first.
 * Proximity is fan-to-THAT-venue, so "four fans near the Sinclair asked" and
 * "four fans in Texas asked for the Sinclair" rank differently, as they should.
 */
export function scoreVenueDemand(requests: readonly VenueDemandRequest[], now: Date = new Date()): VenueDemandEntry[] {
  return groupDemand(
    requests,
    (request) => `venue:${request.venueProfileId}`,
    (request) => request.venue,
    (request) => ({ venueProfileId: request.venueProfileId }),
    now,
  );
}

/** The reason chip: "3 fans asked · 2 nearby · this week". Frequency first. */
export function describeDemand(entry: Pick<DemandEntry, 'fans' | 'nearby' | 'latestAt'>, now: Date = new Date()): string {
  const parts = [entry.fans === 1 ? '1 fan asked' : `${entry.fans} fans asked`];
  if (entry.nearby > 0) parts.push(`${entry.nearby} nearby`);
  const ageDays = (now.getTime() - entry.latestAt.getTime()) / DAY_MS;
  parts.push(ageDays <= 7 ? 'this week' : ageDays <= 30 ? 'this month' : 'earlier');
  return parts.join(' · ');
}

/* ── The fan's own recommendations ───────────────────────────────────────────
   Owner, 2026-09-01: "The recommendation and seed engines feed a big way into
   what a fan will be shown for their own recommendations." A request is the
   strongest taste signal a fan can leave — stronger than a hype, because it
   names a room and asks for a night — so it feeds the two engines that decide
   what THIS fan hears: the computed stations (`stations.ts`) and the discover
   deck (`/api/discover/seeds`). Two signals come out of the same rows:

     requested  — acts the fan asked a venue for. Play them.
     wantedAt   — acts OTHER fans asked for at venues this fan follows or asked.
                  "Fans want them at <Venue>" is a recommendation with a reason
                  the fan already cares about.

   Pure; `request-signals.ts` does the reads. */

export type OwnRequestRow = { artistProfileId: string | null; venueProfileId: string };
export type VenueRequestRow = {
  artistProfileId: string | null;
  venueProfileId: string;
  requesterId: string;
  venueName: string;
};

export type RequestSignals = {
  /** Acts the viewer asked for, in no particular order. */
  requestedArtistIds: string[];
  /** Venues the viewer asked — a room they care about. */
  requestedVenueIds: string[];
  /** Acts other fans want at the viewer's venues, strongest first. */
  wantedAt: { artistProfileId: string; venueName: string; fans: number }[];
};

export function summarizeRequestSignals(
  own: readonly OwnRequestRow[],
  atVenues: readonly VenueRequestRow[],
  viewerId: string,
): RequestSignals {
  const requestedArtistIds = [...new Set(own.map((row) => row.artistProfileId).filter((id): id is string => Boolean(id)))];
  const requestedVenueIds = [...new Set(own.map((row) => row.venueProfileId))];
  const requested = new Set(requestedArtistIds);

  // Distinct fans per act, and the venue with the most of them for the reason.
  const fansByArtist = new Map<string, Set<string>>();
  const fansByArtistVenue = new Map<string, Map<string, { name: string; fans: Set<string> }>>();
  for (const row of atVenues) {
    if (!row.artistProfileId || row.requesterId === viewerId || requested.has(row.artistProfileId)) continue;
    let fans = fansByArtist.get(row.artistProfileId);
    if (!fans) fansByArtist.set(row.artistProfileId, (fans = new Set()));
    fans.add(row.requesterId);
    let venues = fansByArtistVenue.get(row.artistProfileId);
    if (!venues) fansByArtistVenue.set(row.artistProfileId, (venues = new Map()));
    let venue = venues.get(row.venueProfileId);
    if (!venue) venues.set(row.venueProfileId, (venue = { name: row.venueName, fans: new Set() }));
    venue.fans.add(row.requesterId);
  }

  const wantedAt = [...fansByArtist.entries()]
    .map(([artistProfileId, fans]) => {
      const venues = [...(fansByArtistVenue.get(artistProfileId)?.values() ?? [])];
      venues.sort((a, b) => b.fans.size - a.fans.size || a.name.localeCompare(b.name));
      return { artistProfileId, venueName: venues[0]?.name ?? '', fans: fans.size };
    })
    .sort((a, b) => b.fans - a.fans || a.artistProfileId.localeCompare(b.artistProfileId));

  return { requestedArtistIds, requestedVenueIds, wantedAt };
}

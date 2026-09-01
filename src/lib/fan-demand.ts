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

/** Ranked demand, strongest first. Empty input → empty output. */
export function scoreFanDemand(requests: readonly DemandRequest[], venue: DemandVenue, now: Date = new Date()): DemandEntry[] {
  type Group = DemandEntry & { perFan: Map<string, { weight: number; nearby: boolean }> };
  const groups = new Map<string, Group>();

  for (const request of requests) {
    const key = demandKey(request);
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        artistProfileId: request.artistProfileId,
        artistName: request.artistName.trim(),
        fans: 0,
        requests: 0,
        nearby: 0,
        latestAt: request.createdAt,
        weight: 0,
        perFan: new Map(),
      };
      groups.set(key, group);
    }
    group.requests += 1;
    if (request.createdAt > group.latestAt) group.latestAt = request.createdAt;

    const proximity = proximityWeight(request, venue);
    const weight = recencyWeight(request.createdAt, now) * proximity.weight;
    const best = group.perFan.get(request.requesterId);
    // One fan, however often they ask, is one fan: keep their strongest ask.
    if (!best || weight > best.weight) {
      group.perFan.set(request.requesterId, { weight, nearby: proximity.nearby || Boolean(best?.nearby) });
    } else if (proximity.nearby && !best.nearby) {
      best.nearby = true;
    }
  }

  const entries: DemandEntry[] = [];
  for (const group of groups.values()) {
    let weight = 0;
    let nearby = 0;
    for (const fan of group.perFan.values()) {
      weight += fan.weight;
      if (fan.nearby) nearby += 1;
    }
    const { perFan, ...entry } = group;
    entries.push({ ...entry, fans: perFan.size, nearby, weight });
  }

  return entries.sort(
    (a, b) => b.weight - a.weight || b.fans - a.fans || b.latestAt.getTime() - a.latestAt.getTime(),
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

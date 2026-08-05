/**
 * Bounded map queries and pin placement — the pure half of the Map module.
 *
 * From the "Music · Map · Me" handoff (DESIGN_SYNC row 267):
 *
 *   - `BACKEND_REWRITE.md` §5: "`bbox` is required. Reject unbounded requests."
 *     and "Server-side clustering above county zoom. At state/country/global
 *     zoom, return aggregate counts per cell rather than individual rows; the
 *     client's collision de-clustering is for county zoom only and will not
 *     save you from 10,000 pins."
 *   - `FRONTEND_GOTCHAS.md` §1/§2: place pins in screen space, cull before
 *     placing, and derive the DOM and the hit test from ONE array.
 *
 * Everything here is pure so it can be unit-tested and so the same clustering
 * rule is used by the three `/api/map/*` routes without being written out
 * three times. No `@/lib/db` import — see the same rule on
 * `src/lib/profile-stats-catalog.ts` and `src/lib/app-nav.ts`.
 */

export type Bbox = { west: number; south: number; east: number; north: number };

/** The four scope chips in the map's control row, and their zoom bands. */
export const MAP_SCOPES = ['county', 'state', 'country', 'global'] as const;
export type MapScope = (typeof MAP_SCOPES)[number];

/**
 * Camera per scope chip, from the prototype's own SCOPES table. Kept here
 * rather than in the component so the client and any future server-rendered
 * initial view agree on what "State" means.
 */
export const SCOPE_CAMERAS: Record<MapScope, { center: [number, number]; zoom: number }> = {
  county: { center: [-70.2568, 43.6565], zoom: 13.6 },
  state: { center: [-69.4, 45.2], zoom: 7 },
  country: { center: [-96.5, 39.5], zoom: 4 },
  global: { center: [8, 26], zoom: 2 },
};

/**
 * Above this zoom the server returns individual rows and the client
 * de-collides them; at or below it the server returns aggregate cells. The
 * threshold is the prototype's own `this._view.z <= 5.5` branch.
 */
export const CLUSTER_ZOOM_CEILING = 5.5;

/** Hard cap on rows returned per request, per §5 ("Cap results per request"). */
export const MAP_ROW_LIMIT = 240;

/**
 * Parses the `bbox=w,s,e,n` query parameter. Returns null for anything that is
 * not four finite, in-range, correctly-ordered numbers — the caller turns that
 * into a 400 rather than silently widening to the whole world, which is the
 * failure mode §5 exists to prevent.
 *
 * A bbox may legitimately cross the antimeridian (west > east) when panning
 * across the Pacific, so that case is accepted and reported via
 * `bboxCrossesAntimeridian`; only a south > north box is nonsense.
 */
export function parseBbox(raw: string | null | undefined): Bbox | null {
  if (!raw) return null;
  const parts = raw.split(',');
  if (parts.length !== 4) return null;
  const [west, south, east, north] = parts.map((part) => Number(part.trim()));
  if (![west, south, east, north].every((value) => Number.isFinite(value))) return null;
  if (Math.abs(south) > 90 || Math.abs(north) > 90) return null;
  if (Math.abs(west) > 180 || Math.abs(east) > 180) return null;
  if (south >= north) return null;
  return { west, south, east, north };
}

export function bboxCrossesAntimeridian(bbox: Bbox): boolean {
  return bbox.west > bbox.east;
}

/**
 * Widens a bbox by a fraction of its own span so a pin just off the edge is
 * already loaded when the user pans a few pixels. Clamped to valid latitudes;
 * a longitude pad that would wrap past ±180 degrades to the full span rather
 * than producing an invalid box.
 */
export function padBbox(bbox: Bbox, fraction = 0.15): Bbox {
  const latPad = (bbox.north - bbox.south) * fraction;
  const lngSpan = bboxCrossesAntimeridian(bbox)
    ? 360 - bbox.west + bbox.east
    : bbox.east - bbox.west;
  const lngPad = lngSpan * fraction;
  const west = bbox.west - lngPad;
  const east = bbox.east + lngPad;
  const wraps = west < -180 || east > 180 || lngSpan + lngPad * 2 >= 360;
  return {
    south: Math.max(-90, bbox.south - latPad),
    north: Math.min(90, bbox.north + latPad),
    west: wraps ? -180 : west,
    east: wraps ? 180 : east,
  };
}

/** Clamps a `zoom` query param to the range the map itself allows. */
export function parseZoom(raw: string | null | undefined, fallback = 13): number {
  // `Number(null)` and `Number('')` are both 0 — finite, so a bare
  // Number.isFinite check would clamp a missing parameter to zoom 1 (the whole
  // world) instead of falling back. That is the same class of silent widening
  // parseBbox exists to prevent.
  if (raw === null || raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(20, value));
}

export function scopeForZoom(zoom: number): MapScope {
  if (zoom >= 10) return 'county';
  if (zoom >= 6) return 'state';
  if (zoom >= 3) return 'country';
  return 'global';
}

export function shouldClusterServerSide(zoom: number): boolean {
  return zoom <= CLUSTER_ZOOM_CEILING;
}

/**
 * Cell size for server-side clustering. The prototype grouped on
 * `Math.round(lng / 6)` at global zoom; this keeps that 6° cell for the
 * widest view and tightens it as the camera comes in, so a country-zoom view
 * of the US resolves to metro-sized cells rather than one blob per timezone.
 */
export function clusterCellDegrees(zoom: number): number {
  if (zoom <= 2.5) return 6;
  if (zoom <= 4) return 3;
  return 1;
}

export type ClusterInput = { latitude: number; longitude: number };
export type Cluster<T extends ClusterInput> = {
  /** Cell centroid — the average of its members, not the cell corner, so the
   *  bubble sits over the actual density rather than on a grid line. */
  latitude: number;
  longitude: number;
  count: number;
  /** One representative member, for the sheet's "City · N listings" header. */
  sample: T;
};

/**
 * Buckets points onto a fixed degree grid. Deterministic and order-stable:
 * cells come back in the order their first member appeared, so a repeated
 * request paints the same bubbles in the same order.
 */
export function clusterPoints<T extends ClusterInput>(points: readonly T[], cellDegrees: number): Array<Cluster<T>> {
  const cells = new Map<string, { latSum: number; lngSum: number; count: number; sample: T }>();
  for (const point of points) {
    if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)) continue;
    const key = `${Math.round(point.latitude / cellDegrees)},${Math.round(point.longitude / cellDegrees)}`;
    const cell = cells.get(key);
    if (cell) {
      cell.latSum += point.latitude;
      cell.lngSum += point.longitude;
      cell.count += 1;
    } else {
      cells.set(key, { latSum: point.latitude, lngSum: point.longitude, count: 1, sample: point });
    }
  }
  return [...cells.values()].map((cell) => ({
    latitude: cell.latSum / cell.count,
    longitude: cell.lngSum / cell.count,
    count: cell.count,
    sample: cell.sample,
  }));
}

/* ────────────────────────────────────────────────────────────────────────────
 * Screen-space pin placement
 * ──────────────────────────────────────────────────────────────────────────── */

/** Collision box per pin kind, from the prototype: event price pills are
 *  narrow, venue and artist pills carry a name and are much wider. */
export const PIN_COLLISION: Record<'event' | 'venue' | 'artist', { width: number; height: number }> = {
  event: { width: 46, height: 26 },
  venue: { width: 120, height: 26 },
  artist: { width: 120, height: 26 },
};

/** How far outside the frame a pin may sit before it is dropped entirely. */
export const CULL_PADDING = 80;

const RING_RADIUS = 30;
const SLOTS_PER_RING = 6;
/** The fan is squashed on y so the spread reads as elliptical, matching the
 *  foreshortening of a map rather than a circle drawn on glass. */
const Y_SQUASH = 0.72;
const MAX_ATTEMPTS = 24;

export type PinCandidate<T> = { item: T; x: number; y: number };
export type PlacedPin<T> = {
  item: T;
  /** True position — where the thing actually is. */
  x: number;
  y: number;
  /** Adjusted position — where its pill is drawn after de-collision. */
  ax: number;
  ay: number;
  /** Whether de-collision moved it. Offset pins get a longer leader line so
   *  the true location stays readable (12px vs 7px). */
  offset: boolean;
};

/**
 * Culls, then de-collides, in one pass — and returns ONE array.
 *
 * `FRONTEND_GOTCHAS.md` §2: "If you render pins from one array and hit-test
 * against another, they will drift apart." So this is the only source for both
 * the markers and the hit test; callers must not filter it again afterwards.
 * §1 is the reason culling happens *before* placement rather than after: an
 * earlier prototype culled visually but still padded the hit array, so taps in
 * empty space opened sheets for offscreen events.
 */
export function placePins<T>(
  candidates: readonly PinCandidate<T>[],
  {
    width,
    height,
    collision,
    padding = CULL_PADDING,
  }: {
    width: number;
    height: number;
    collision: { width: number; height: number };
    padding?: number;
  },
): Array<PlacedPin<T>> {
  const placed: Array<PlacedPin<T>> = [];
  for (const candidate of candidates) {
    const { x, y } = candidate;
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (x < -padding || x > width + padding || y < -padding || y > height + padding) continue;
    placed.push({ item: candidate.item, x, y, ax: x, ay: y, offset: false });
  }

  placed.forEach((current, index) => {
    let ring = 0;
    let slot = 0;
    let attempts = 0;
    const clashes = () => placed.some((other, otherIndex) => otherIndex < index
      && Math.abs(other.ax - current.ax) < collision.width
      && Math.abs(other.ay - current.ay) < collision.height);
    while (clashes() && attempts++ < MAX_ATTEMPTS) {
      if (slot === 0) {
        ring += 1;
        slot = ring * SLOTS_PER_RING;
      }
      const count = ring * SLOTS_PER_RING;
      const step = count - slot;
      const angle = (step / count) * Math.PI * 2 - Math.PI / 2;
      const radius = ring * RING_RADIUS;
      current.ax = current.x + Math.cos(angle) * radius;
      current.ay = current.y + Math.sin(angle) * radius * Y_SQUASH;
      slot -= 1;
    }
    current.offset = Math.abs(current.ax - current.x) > 1 || Math.abs(current.ay - current.y) > 1;
  });

  return placed;
}

/** A show is "hot" — and inverts to a solid accent fill — above 75% sold. */
export function isHotEvent(sold: number, capacity: number): boolean {
  return capacity > 0 && sold / capacity > 0.75;
}

/** The map's result line, e.g. "6 events · all · tap a pin for their page". */
export function resultLine(count: number, layer: 'events' | 'venues' | 'artists', genre: string): string {
  const noun = count === 1
    ? { events: 'event', venues: 'venue', artists: 'artist' }[layer]
    : layer;
  return `${count} ${noun} · ${genre.toLowerCase()} · tap a pin for their page`;
}

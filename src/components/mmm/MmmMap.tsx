'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { PermissionPrimerSheet, usePermissionPrimer } from '@/components/PermissionPrimerSheet';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { describeSelection, stripDays, toDatesParam, toggleDay } from '@/lib/map-dates';
import {
  MAP_SCOPES,
  PIN_COLLISION,
  SCOPE_CAMERAS,
  type MapScope,
  isHotEvent,
  placePins,
  resultLine,
} from '@/lib/map-bbox';
import type { MapCluster, MapEventPin } from '@/app/api/map/events/route';
import type { MapVenuePin } from '@/app/api/map/venues/route';
import type { MapArtistCity } from '@/app/api/map/artists/route';

export type MapLayer = 'events' | 'venues' | 'artists';
export type MapSheetTarget =
  | { kind: 'event'; data: MapEventPin }
  | { kind: 'venue'; data: MapVenuePin }
  | { kind: 'artistCity'; data: MapArtistCity }
  | { kind: 'cluster'; data: MapCluster };

const GENRES = ['All', 'Dream-pop', 'Indie', 'Electronic', 'Punk', 'Jazz', 'Hip-hop'] as const;
const LAYERS: Array<{ id: MapLayer; label: string }> = [
  { id: 'events', label: 'Events' },
  { id: 'venues', label: 'Venues' },
  { id: 'artists', label: 'Artists' },
];

type Placed = { key: string; ax: number; ay: number; offset: boolean; target: MapSheetTarget };

/** One row in the layer search: what to show, where to fly, what to open. */
type LayerHit = {
  key: string;
  title: string;
  detail: string;
  lngLat: [number, number];
  zoom: number;
  target: MapSheetTarget;
};

/**
 * The layer search is only ever offered where the layer draws something a name
 * can identify. Events are excluded by the design source too: an event pin is a
 * price, and its date strip is the filter that layer actually has.
 */
type SearchableLayer = 'venues' | 'artists';
// A predicate rather than an `includes` test: this narrows, so the component
// below takes the two layers it handles instead of every layer plus a cast.
function isSearchableLayer(layer: MapLayer): layer is SearchableLayer {
  return layer === 'venues' || layer === 'artists';
}

/** Both strings are the design source's, swapped with the layer. */
const SEARCH_PLACEHOLDER: Record<SearchableLayer, string> = {
  artists: 'Search artists, genres, cities',
  venues: 'Search venues, streets, cities',
};

/**
 * The Map module — a real slippy map with bounded queries and de-collided pins.
 *
 * ## Why maplibre rather than the prototype's hand-rolled tile grid
 *
 * `SimplifiedApp.dc.html` projects, tiles, drags, pinches and wheel-zooms by
 * hand, because its prototyping runtime had no map library. `FRONTEND_GOTCHAS`
 * §2 and §3 are artifacts of that: a hand-maintained hit-test array drifting
 * from the render array, and a `ResizeObserver` re-entrancy loop that could
 * silently freeze the map for a whole session. maplibre-gl — already a
 * dependency of this codebase, used by the existing module deck — removes both
 * failure modes structurally, which is what the handoff means by "rebuild in
 * the target codebase's real environment using its established patterns."
 *
 * ## What is kept verbatim from the design
 *
 * CARTO dark raster tiles over OSM with the required attribution; the price-pill
 * event pins with a leader line; hot inversion above 75% sold; the layer / scope
 * / genre chip rows; the result line; and — the part a map library does *not*
 * give you — screen-space collision de-clustering, computed through
 * `placePins()` from `map-bbox.ts` so the exact fan-out geometry is unit-tested
 * rather than eyeballed. §1's "cull first, and derive the DOM and the hit test
 * from ONE array" is honoured by rendering React markers from `placed` and
 * nothing else; there is no second array to drift from.
 *
 * Pins are absolutely-positioned React nodes over the canvas rather than
 * maplibre Markers, because a Marker owns its own transform and would fight the
 * de-collision offset.
 */
export function MmmMap({
  active,
  onOpenSheet,
}: {
  /** False while a module pane covers the map: skip fetches and repaints. */
  active: boolean;
  onOpenSheet: (target: MapSheetTarget) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [scope, setScope] = useState<MapScope>('county');
  const [layer, setLayer] = useState<MapLayer>('events');

  // The date strip. A SET of days, not a span — Design System 8's map document
  // is explicit that Friday and Sunday with nothing between them is a legal
  // selection, "which is what anyone planning a weekend actually wants".
  // Computed once per mount rather than per render: `stripDays(new Date())`
  // inside the body would produce a new array every render and re-run the
  // effect below forever.
  const [days] = useState(() => stripDays(new Date()));
  const [selectedDays, setSelectedDays] = useState<ReadonlySet<string>>(() => new Set());
  const datesParam = toDatesParam(selectedDays);
  const [genre, setGenre] = useState<string>('All');
  const [events, setEvents] = useState<MapEventPin[]>([]);
  const [venues, setVenues] = useState<MapVenuePin[]>([]);
  const [cities, setCities] = useState<MapArtistCity[]>([]);
  const [clusters, setClusters] = useState<MapCluster[]>([]);
  const [total, setTotal] = useState(0);
  const [paused, setPaused] = useState(false);
  const [placed, setPlaced] = useState<Placed[]>([]);
  /** Bumped on every map move so placement recomputes against the new camera. */
  const [cameraTick, setCameraTick] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;
    let disposed = false;
    void import('maplibre-gl').then((maplibre) => {
      if (disposed || !containerRef.current) return;
      const camera = SCOPE_CAMERAS.county;
      const map = new maplibre.Map({
        attributionControl: false,
        container: containerRef.current,
        dragRotate: false,
        maxPitch: 0,
        pitchWithRotate: false,
        touchPitch: false,
        center: camera.center,
        zoom: camera.zoom,
        // CARTO dark raster over OSM data, as the handoff specifies. Declared
        // inline rather than fetched as a style JSON so the map has no
        // additional network dependency before it can draw.
        style: {
          version: 8,
          sources: {
            carto: {
              type: 'raster',
              tiles: [
                'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
                'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
                'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
                'https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
              ],
              tileSize: 256,
              attribution: '© OpenStreetMap · CARTO',
            },
          },
          layers: [{ id: 'carto', type: 'raster', source: 'carto' }],
        },
      });
      mapRef.current = map;
      const bump = () => setCameraTick((tick) => tick + 1);
      map.on('load', () => { setReady(true); bump(); });
      map.on('move', bump);
      map.on('moveend', bump);
      map.on('resize', bump);
      // A tile 404 or a style error must degrade one frame, not the feature —
      // §3's "an early version threw on the first update and silently disabled
      // the map for the rest of the session".
      map.on('error', (event) => {
        // eslint-disable-next-line no-console -- surfaced to the browser only; a tile miss is not a Sentry event
        console.warn('mmm map error', event?.error?.message ?? event);
      });
    }).catch(() => setFailed(true));
    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Scope chip → camera. The prototype resets the view on scope change, which
  // is the point of the chips: they are presets, not filters.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const camera = SCOPE_CAMERAS[scope];
    map.jumpTo({ center: camera.center, zoom: camera.zoom });
  }, [ready, scope]);

  /** Fetches the active layer for the current viewport. */
  const load = useCallback(async () => {
    const map = mapRef.current;
    if (!map || !ready || !active) return;
    const bounds = map.getBounds();
    const bbox = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()]
      .map((value) => value.toFixed(4)).join(',');
    const params = new URLSearchParams({ bbox, zoom: map.getZoom().toFixed(2) });
    if (genre !== 'All') params.set('genre', genre);
    // Only the events layer has dates. Sending them on the venues or artists
    // layer would be a filter those endpoints do not implement and a URL that
    // busts their cache for no reason.
    if (layer === 'events' && datesParam) params.set('dates', datesParam);
    try {
      const response = await fetch(`/api/map/${layer}?${params.toString()}`, { cache: 'no-store' });
      if (response.status === 503) {
        setPaused(true);
        setEvents([]); setVenues([]); setCities([]); setClusters([]); setTotal(0);
        return;
      }
      setPaused(false);
      if (!response.ok) return;
      const payload = await response.json();
      setClusters(payload.clustered && payload.clusters ? payload.clusters : []);
      setEvents(layer === 'events' && !payload.clustered ? payload.pins ?? [] : []);
      setVenues(layer === 'venues' && !payload.clustered ? payload.pins ?? [] : []);
      setCities(layer === 'artists' ? payload.cities ?? [] : []);
      setTotal(payload.total ?? 0);
    } catch {
      // Leave the last good set on screen rather than blanking the map.
    }
  }, [active, datesParam, genre, layer, ready]);

  // Debounced against the camera tick: a pan fires `move` per frame, and one
  // request per frame would be a self-inflicted denial of service.
  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => { void load(); }, 220);
    return () => window.clearTimeout(timer);
  }, [active, cameraTick, load]);

  // "Near me". The layer works from the seeded home until (and unless) the
  // browser answers, and a denial or a timeout is not an error state — the
  // control stays, it just recentres on the seeded camera instead.
  //
  // It NO LONGER asks on mount. `getCurrentPosition` is the OS prompt on a
  // phone, and firing it the instant the map appears spends the one prompt an
  // install gets before the member has any idea what it buys them. The primer
  // sheet asks first, in our own words, and only an accept reaches the
  // browser. Declining is remembered and never re-asked.
  const [home, setHome] = useState<[number, number] | null>(null);
  const flownHome = useRef(false);
  const [geolocationSettled, setGeolocationSettled] = useState(false);
  const locationPrimer = usePermissionPrimer('location', geolocationSettled);

  const requestPosition = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => setHome([position.coords.longitude, position.coords.latitude]),
      () => setGeolocationSettled(true),
      { timeout: 6000, maximumAge: 600000 },
    );
  }, []);

  // If the OS already has an answer from a previous session, skip our sheet
  // and use it — asking again would be theatre. `permissions.query` is not
  // universal, so its absence simply leaves the primer in charge.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) return;
    let cancelled = false;
    navigator.permissions.query({ name: 'geolocation' as PermissionName })
      .then((status) => {
        if (cancelled || status.state === 'prompt') return;
        setGeolocationSettled(true);
        if (status.state === 'granted') requestPosition();
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [requestPosition]);

  // NOT asked on arrival, and this is a deliberate departure from the
  // permissions template's "Fires on first Map open".
  //
  // That line assumes the map is somewhere you navigate TO. Here it is
  // `WORKBENCH_PATH`: `/` and every sign-in resolve to `/app/map`, so the first
  // Map open IS the launch — and MOBILE.md's rule is that a capability is asked
  // for "at the moment of use and never on launch". Auto-opening put a sheet
  // with a scrim over the whole shell before the member had touched anything,
  // covering the arc nav; the e2e that proves the map survives a module change
  // caught it by being unable to reach the navigation at all.
  //
  // So the ask belongs to "Near me", which is the moment of use and an explicit
  // request. Until then the map works from the seeded camera, which is the same
  // thing it does when location is refused.

  const recentre = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({ center: home ?? SCOPE_CAMERAS.county.center, zoom: 12, duration: 800 });
  }, [home]);

  // If the browser answers while the artists layer is up, the design flies
  // there — that layer is the one whose whole question is "who is near me".
  // Once only: re-flying on every return to the layer would fight a pan.
  useEffect(() => {
    if (!ready || !home || layer !== 'artists' || flownHome.current) return;
    flownHome.current = true;
    recentre();
  }, [home, layer, ready, recentre]);

  /**
   * Where the layer search sends the camera. `flyTo` and not `jumpTo`: the
   * result is somewhere the member has not looked, and an instant cut leaves
   * them with no idea which way they moved. 800ms is the design's duration,
   * shared with `recentre`.
   */
  const goTo = useCallback((lngLat: [number, number], zoom: number) => {
    mapRef.current?.flyTo({ center: lngLat, zoom, duration: 800 });
  }, []);

  const collision = layer === 'events' ? PIN_COLLISION.event : PIN_COLLISION.venue;

  const candidates = useMemo(() => {
    if (clusters.length) {
      return clusters.map((cluster, index) => ({
        key: `cluster-${index}`,
        lngLat: [cluster.longitude, cluster.latitude] as [number, number],
        target: { kind: 'cluster', data: cluster } as MapSheetTarget,
      }));
    }
    if (layer === 'events') {
      return events.map((pin) => ({
        key: `event-${pin.id}`,
        lngLat: [pin.longitude, pin.latitude] as [number, number],
        target: { kind: 'event', data: pin } as MapSheetTarget,
      }));
    }
    if (layer === 'venues') {
      return venues.map((pin) => ({
        key: `venue-${pin.id}`,
        lngLat: [pin.longitude, pin.latitude] as [number, number],
        target: { kind: 'venue', data: pin } as MapSheetTarget,
      }));
    }
    return cities.map((city) => ({
      key: `city-${city.city}`,
      lngLat: [city.longitude, city.latitude] as [number, number],
      target: { kind: 'artistCity', data: city } as MapSheetTarget,
    }));
  }, [cities, clusters, events, layer, venues]);

  // Project → cull → de-collide, in one pass producing one array. Guarded
  // against re-entrancy and wrapped so a projection throw costs one frame.
  const paintingRef = useRef(false);
  useEffect(() => {
    const map = mapRef.current;
    const node = containerRef.current;
    if (!map || !node || !ready) return;
    if (paintingRef.current) return;
    paintingRef.current = true;
    try {
      const projected = candidates.map((candidate) => {
        const point = map.project(candidate.lngLat);
        return { item: candidate, x: point.x, y: point.y };
      });
      setPlaced(placePins(projected, {
        width: node.clientWidth,
        height: node.clientHeight,
        collision,
      }).map((pin) => ({
        key: pin.item.key,
        ax: pin.ax,
        ay: pin.ay,
        offset: pin.offset,
        target: pin.item.target,
      })));
    } catch {
      // Degrade one frame, not the whole feature.
    } finally {
      paintingRef.current = false;
    }
  }, [cameraTick, candidates, collision, ready]);

  return (
    <div className="mmm-map-layer">
      <div className="mmm-map-canvas" ref={containerRef} />
      <div className="mmm-map-attrib">© OpenStreetMap · CARTO</div>

      {/* Accepting reaches the browser; declining does not, and is remembered.
          Either way the map is already drawn on the seeded camera behind this
          sheet — the design's "no empty state" for a refusal. */}
      <PermissionPrimerSheet
        id="location"
        onAccept={() => { locationPrimer.close(); requestPosition(); }}
        onDecline={() => { locationPrimer.close(); setGeolocationSettled(true); }}
        open={locationPrimer.open}
      />

      {placed.map((pin) => (
        <MapPin key={pin.key} onOpen={() => onOpenSheet(pin.target)} pin={pin} />
      ))}

      {active && (
        <>
          {/* One chip row: the LAYER, and nothing else.
              `templates/simplified-app/map.html` — the map's own design source
              — carries exactly three chips and no second row. The scope chips
              (County/State/Country/Global) and the genre chips were built here
              and appear in no design; two rows of filters above a map is most
              of a phone screen spent on controls before you have seen a pin.

              The API still accepts `genre`, so the filter is not gone from the
              backend — only from a control surface that never had it. */}
          <div className="mmm-map-controls">
            <div className="mmm-control-row">
              <div className="mmm-map-chips">
                {LAYERS.map((entry) => (
                  <button
                    aria-pressed={layer === entry.id}
                    className="mmm-map-chip"
                    key={entry.id}
                    onClick={() => setLayer(entry.id)}
                    type="button"
                  >
                    {entry.label}
                  </button>
                ))}
              </div>
              {/* `#near` rides beside the chips on the ARTISTS layer only, and
                  nowhere else — an artist pin is a city of origin rather than
                  an address, so "how many are around here" is the only reading
                  the count has. Events and venues answer that with their own
                  pins. */}
              {layer === 'artists' && (
                <div className="mmm-map-near">
                  <span aria-live="polite">
                    {total > 0
                      ? `${total} artist${total === 1 ? '' : 's'} here`
                      : 'None in view — zoom out'}
                  </span>
                  {/* Tapping this IS a request for the capability, so it opens
                      the primer if it has never been shown. It does NOT reopen
                      for someone who already declined — `ask()` returns false
                      there and the camera falls back to the seeded city, which
                      is the designed refusal path rather than a dead button. */}
                  <button
                    className="mmm-map-recentre"
                    onClick={() => { if (!home && locationPrimer.ask()) return; recentre(); }}
                    type="button"
                  >
                    Near me
                  </button>
                </div>
              )}
            </div>
            {/* Under the selectors, on the venues and artists layers only —
                where the layer draws something a name can identify. */}
            {isSearchableLayer(layer) && (
              <MapLayerSearch
                cities={cities}
                layer={layer}
                onGoTo={goTo}
                onOpenSheet={onOpenSheet}
                venues={venues}
              />
            )}
            {/* The date strip belongs to the events layer alone: only an event has
                a date. Venues and artists keep the chips above and nothing else,
                which is also why the API is not sent a `dates` param for them.

                It must stay INSIDE `.mmm-map-controls`. That container is
                `position: absolute` and a flex column — the row gap is what
                separates the chips from whatever is under them. As a sibling it
                sat in normal flow at the top of `.mmm-map-layer`, i.e. directly
                beneath the absolutely-positioned chips, and the two painted on
                top of each other on a real phone: EVENTS over WED, VENUES over
                THU. Reported from an iPhone, not caught by any test. */}
            {layer === 'events' && (
              <div className="mmm-date-block">
                <div className="mmm-date-strip" role="group" aria-label="Filter by date">
                  {days.map((day) => (
                    <button
                      aria-pressed={selectedDays.has(day.key)}
                      className="mmm-date-pill"
                      key={day.key}
                      onClick={() => setSelectedDays((current) => toggleDay(current, day.key))}
                      type="button"
                    >
                      <span className="mmm-date-dow">{day.weekday}</span>
                      <span className="mmm-date-day">{day.day}</span>
                      <span className="mmm-date-mon">{day.month}</span>
                    </button>
                  ))}
                </div>
                <div className="mmm-date-summary">
                  <span className="mmm-date-label">Dates</span>
                  <span className="mmm-date-value">{describeSelection(selectedDays, days)}</span>
                  {selectedDays.size > 0 && (
                    <button
                      className="mmm-date-clear"
                      onClick={() => setSelectedDays(new Set())}
                      type="button"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
          {/* No standing result caption: the map's design source has none, and
              "tap a pin for their page" is an instruction the pins already
              give by being tappable. The two FAILURE lines stay — those say
              something the map cannot show by itself. */}
          {(failed || paused) && (
            <div className="mmm-result-line" role="status">
              {failed
                ? 'The map could not load. Everything else still works.'
                : 'Map lookups are paused right now — try again shortly.'}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Search bound to the layer that is showing.
 *
 * The rule from `templates/simplified-app/map.html`, verbatim: the bar "belongs
 * to whichever layer is showing and only ever matches things that layer draws:
 * venues on the venues layer, artists on the artists layer. Matching an artist
 * while venues are drawn would send you to a pin that does not exist."
 *
 * **It searches what the layer has LOADED, which is what it draws — the bbox.**
 * The design's fixture arrays are the whole world, so there the distinction does
 * not arise; here `/api/map/*` rejects an unbounded request outright
 * (`BBOX_REQUIRED`, `BACKEND_REWRITE.md` §5, and an e2e test asserts it on all
 * three layers), so there is no way to find a venue outside the viewport AND
 * still have a coordinate to fly to. Rather than pretend otherwise, the empty
 * state says the search covers the current view and offers `/search`, which
 * really does cover everything. Widening this properly needs a place lookup the
 * codebase does not have — an artist has no coordinate at all by design
 * (`sanitizeStoredProfileLocation` nulls lat/lng on every non-VENUE profile).
 */
function MapLayerSearch({
  cities,
  layer,
  onGoTo,
  onOpenSheet,
  venues,
}: {
  cities: MapArtistCity[];
  layer: SearchableLayer;
  onGoTo: (lngLat: [number, number], zoom: number) => void;
  onOpenSheet: (target: MapSheetTarget) => void;
  venues: MapVenuePin[];
}) {
  const [term, setTerm] = useState('');
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Switching layers clears the field. The design calls `hide()` on every layer
  // change for the same reason: a term typed against venues matches nothing on
  // artists, and leaving it there reads as "no results" rather than "new layer".
  useEffect(() => { setTerm(''); }, [layer]);

  // Click-out dismisses, matching the design's document-level pointerdown. It
  // is `pointerdown` and not `click` so a drag that starts on the map closes
  // the list before the map begins panning under it.
  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (wrapRef.current?.contains(event.target as Node)) return;
      setTerm('');
    }
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, []);

  const trimmed = term.trim().toLowerCase();

  const hits = useMemo<LayerHit[]>(() => {
    if (!trimmed) return [];
    if (layer === 'artists') {
      // Flattened out of the city bubbles, because that is what the layer
      // draws: each city carries up to five hype-ranked artists, and the city
      // is the only coordinate any of them has.
      return cities.flatMap((city) =>
        city.artists
          .filter((artist) =>
            `${artist.name} ${city.city} ${artist.genres.join(' ')}`.toLowerCase().includes(trimmed))
          .map((artist) => ({
            key: `artist-${artist.id}`,
            title: artist.name,
            detail: [artist.genres[0], city.city].filter(Boolean).join(' · '),
            lngLat: [city.longitude, city.latitude] as [number, number],
            // The design's zoom for an artist result: a city, not an address.
            zoom: 11,
            target: { kind: 'artistCity', data: city } as MapSheetTarget,
          })));
    }
    return venues
      .filter((venue) =>
        `${venue.name} ${venue.city ?? ''} ${venue.addressLine1 ?? ''}`.toLowerCase().includes(trimmed))
      .map((venue) => ({
        key: `venue-${venue.id}`,
        title: venue.name,
        detail: venue.addressLine1 ?? venue.city ?? '',
        lngLat: [venue.longitude, venue.latitude] as [number, number],
        // A venue is an address, so the design flies far closer than for a city.
        zoom: 15,
        target: { kind: 'venue', data: venue } as MapSheetTarget,
      }));
  }, [cities, layer, trimmed, venues]);

  const select = (hit: LayerHit) => {
    onGoTo(hit.lngLat, hit.zoom);
    onOpenSheet(hit.target);
    setTerm('');
    inputRef.current?.blur();
  };

  return (
    <div className="mmm-map-search" ref={wrapRef}>
      <div className="mmm-search-field">
        <span aria-hidden="true" className="mmm-search-glyph">⌕</span>
        <input
          aria-label={SEARCH_PLACEHOLDER[layer]}
          autoComplete="off"
          className="mmm-search-input"
          onChange={(event) => setTerm(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Escape') return;
            setTerm('');
            inputRef.current?.blur();
          }}
          placeholder={SEARCH_PLACEHOLDER[layer]}
          ref={inputRef}
          type="search"
          value={term}
        />
      </div>

      {trimmed.length > 0 && (
        <div aria-live="polite" className="mmm-search-results">
          {hits.length === 0 ? (
            <>
              <p className="mmm-search-note">
                {layer === 'artists'
                  ? 'No artists match that in view. Try a city, a genre or part of the name — or move the map.'
                  : 'No venues match that in view. Try a city, a street or part of the name — or move the map.'}
              </p>
              {/* The one honest way out of a viewport-bounded search: a page
                  that really does search everything. */}
              <Link className="mmm-search-result" href={`/search?q=${encodeURIComponent(term.trim())}`}>
                <span className="mmm-search-result-main">
                  <span className="mmm-row-title">Search all of iHYPE for “{term.trim()}”</span>
                  <span className="mmm-row-sub">Leaves the map</span>
                </span>
                <span aria-hidden="true" className="mmm-search-kind">→</span>
              </Link>
            </>
          ) : (
            hits.map((hit) => (
              <button
                className="mmm-search-result"
                key={hit.key}
                onClick={() => select(hit)}
                type="button"
              >
                <span className="mmm-search-result-main">
                  <span className="mmm-row-title">{hit.title}</span>
                  {hit.detail && <span className="mmm-row-sub">{hit.detail}</span>}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function MapPin({ onOpen, pin }: { onOpen: () => void; pin: Placed }) {
  const style = { left: Math.round(pin.ax), top: Math.round(pin.ay), position: 'absolute' as const, zIndex: 10 };

  if (pin.target.kind === 'cluster') {
    const { count, label } = pin.target.data;
    const size = 30 + Math.min(count, 5) * 5;
    return (
      <button
        aria-label={`${count} in ${label}. Zoom in.`}
        className="mmm-bubble"
        onClick={onOpen}
        style={{ ...style, width: size, height: size, transform: 'translate(-50%, -50%)' }}
        type="button"
      >
        {count}
      </button>
    );
  }

  if (pin.target.kind === 'artistCity') {
    const { count, city } = pin.target.data;
    const size = 30 + Math.min(count, 5) * 5;
    return (
      <button
        aria-label={`${count} artist${count === 1 ? '' : 's'} in ${city}`}
        className="mmm-bubble"
        onClick={onOpen}
        style={{ ...style, width: size, height: size, transform: 'translate(-50%, -50%)' }}
        type="button"
      >
        {count}
      </button>
    );
  }

  const anchored = { ...style, transform: 'translate(-50%, -100%)' };

  if (pin.target.kind === 'venue') {
    const venue = pin.target.data;
    return (
      <button
        aria-label={`${venue.name}${venue.city ? `, ${venue.city}` : ''}. Open venue page.`}
        className="mmm-pin mmm-pin-venue"
        data-offset={pin.offset}
        onClick={onOpen}
        style={anchored}
        type="button"
      >
        <span className="mmm-pin-pill">
          <span aria-hidden="true" style={{ color: 'var(--role-venue)' }}>◆</span>
          {venue.name}
        </span>
        <span aria-hidden="true" className="mmm-pin-leader" />
      </button>
    );
  }

  const event = pin.target.data;
  const hot = isHotEvent(event.sold, event.capacity);
  return (
    <button
      aria-label={`${event.title}${event.venueName ? ` at ${event.venueName}` : ''}. ${event.price === null ? 'Free' : `$${event.price}`}.`}
      className="mmm-pin"
      data-hot={hot}
      data-offset={pin.offset}
      onClick={onOpen}
      style={anchored}
      type="button"
    >
      <span className="mmm-pin-pill">{event.price === null ? 'Free' : `$${event.price}`}</span>
      <span aria-hidden="true" className="mmm-pin-leader" />
    </button>
  );
}

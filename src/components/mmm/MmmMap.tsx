'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { describeDayKeys, monthGrid, shiftMonth, toDatesParam, toggleDay } from '@/lib/map-dates';
import { MmmSectionStrip } from '@/components/mmm/MmmSectionStrip';
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
/* The layer's three values live in `MMM_MAP_LAYERS` (`src/lib/mmm-nav.ts`) now
   — the dock's tuner is what selects them, so the labels belong with the rest of
   the nav manifest rather than in two places. */

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
 * The search bar is on every layer as of 2026-08-22, and events are the reason.
 *
 * It used to be venues and artists only — the design source excluded events on
 * the grounds that an event pin is a price and the date strip was that layer's
 * filter. The strip is gone (the dates moved into this bar), so skipping events
 * would mean the layer that owns the date control never draws the bar holding
 * it. An event also turns out to be the easiest of the three to search: the
 * layer already has its title, its venue and its city in hand.
 *
 * `SearchableLayer` and `isSearchableLayer` are gone with the exclusion. There
 * is nothing left for a narrowing predicate to narrow.
 */
const SEARCH_PLACEHOLDER: Record<MapLayer, string> = {
  artists: 'Search artists, genres, cities',
  events: 'Search shows, venues, cities',
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
 * CARTO voyager raster tiles over OSM with the required attribution; the price-pill
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
/* CARTO requires a key on its basemaps, and WHAT THE KEY DOES DEPENDS ON THE
   DELIVERY, which is worth stating precisely because the two were measured and
   they differ.

   On RASTER it is enforced and the enforcement is invisible: an unkeyed
   request still answers 200 with a valid PNG, and the tile simply carries an
   "API KEY REQUIRED" watermark. No 4xx, no error, no log line — the map just
   looks slightly wrong. Measured 2026-09-03: the same tile is 33,863 bytes
   unkeyed and 35,505 keyed.

   On VECTOR — what this file now uses — the key currently changes NOTHING
   observable. Measured the same day: `style.json` is byte-identical keyed and
   unkeyed, and so is a real `.mvt` tile. It is sent anyway, for two honest
   reasons rather than a measured one: CARTO's terms make keys per-customer and
   count the free tier against them, so the key is how this usage is attributed
   to iHYPE rather than to nobody; and enforcement is plainly on its way, given
   what already happened to raster. Do not read the raster measurement as proof
   the vector map would break without it — that has not been shown.

   The parameter is `key`. `api_key` is accepted and ignored, which on the
   raster path failed exactly as silently as sending nothing.

   THE KEY IS PUBLIC BY CONSTRUCTION and committing it is deliberate. The
   browser fetches every tile, so it ships in the client bundle wherever it is
   stored — an env var would move it out of git while changing nothing about
   who can read it. What actually protects it is a domain restriction on
   CARTO's side, not secrecy here. `NEXT_PUBLIC_CARTO_BASEMAP_KEY` overrides it
   so the key can be rotated without a code change. */
const CARTO_BASEMAP_KEY = process.env.NEXT_PUBLIC_CARTO_BASEMAP_KEY
  || 'cb1_2uct_1_4f4a36fe2c256aa044364a6f';

const CARTO_STYLE_URL = `https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json?key=${CARTO_BASEMAP_KEY}`;

/* How long the basemap gets before the map admits it has not arrived. Generous
   against a slow phone connection — the style is ~104 KB before a single tile
   — and it withdraws itself the moment `load` fires, so erring long costs a
   member nothing and erring short would cry wolf on a train. */
const BASEMAP_LOAD_DEADLINE_MS = 15_000;

export function MmmMap({
  active,
  initialLayer,
  onOpenSheet,
}: {
  /** False while a module pane covers the map: skip fetches and repaints. */
  active: boolean;
  initialLayer: MapLayer;
  onOpenSheet: (target: MapSheetTarget) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [ready, setReady] = useState(false);
  /* Collapsed by default — the credit is one tap, not a standing line. */
  const [creditOpen, setCreditOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const [scope, setScope] = useState<MapScope>('county');
  const [layer, setLayer] = useState<MapLayer>(initialLayer);

  // The shell layout persists across navigation. A compatibility URL can
  // therefore arrive after the map has already mounted; keep the requested
  // URL layer authoritative instead of treating it as a one-time default.
  useEffect(() => setLayer(initialLayer), [initialLayer]);

  // Still a SET of days, not a span — Design System 8's map document is
  // explicit that Friday and Sunday with nothing between them is a legal
  // selection, "which is what anyone planning a weekend actually wants". What
  // changed (2026-08-22) is only the CONTROL: the five day cards are gone and
  // the set is filled from a calendar inside the search bar, so there is no
  // longer a bounded strip of offered days to hold in state.
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
    /* A basemap that never arrives must SAY SO rather than draw as an empty
       chart. `failed` used to mean only "the maplibre bundle would not load",
       so the one failure that actually happened in production — our own CSP
       refusing the style document — presented as a blank map with no message
       at all, and the owner had to report it. The whole ground and its ruled
       grid are painted by `mmm.css` over the canvas, so a totally dead basemap
       and a genuinely empty region look identical.

       `load` is the signal, because MapLibre fires it once the style and the
       first tiles are up and never fires it when the style cannot be fetched
       (measured 2026-09-03: with tiles unreachable it had not fired after 40
       seconds — the note on the geolocation effect below records the same
       observation). A deadline rather than an error listener because a style
       refused by CSP, a DNS failure and a dropped connection are one thing to
       a member and arrive as three different events.

       SELF-CORRECTING ON PURPOSE: a slow connection that finishes at 20s
       clears the line and shows the map. So this is "not yet", never a claim
       the map is permanently broken, and being wrong costs one sentence that
       then withdraws itself. */
    let basemapDeadline: ReturnType<typeof setTimeout> | undefined;
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
        /* VECTOR, not raster. Same CARTO Voyager cartography and the same
           attribution — a delivery change, not a vendor or style change.

           WHY: CARTO is retiring the raster service and has said it may stop
           updating its data, so raster is a surface with an end date. Vector
           is the supported path.

           WHAT IT COSTS, because this reverses a decision that was deliberate.
           The style used to be declared INLINE precisely so the map could draw
           with no prior network round-trip; a style URL means one fetch
           (~104 KB) plus glyphs before the first label appears. That is the
           trade, made knowingly: a slower first paint against a basemap that
           still exists next year. Nothing else regresses — the chart treatment
           in `mmm.css` filters the composited canvas, so it applies to vector
           exactly as it did to raster, and labels now re-render at every zoom
           instead of softening between raster levels.

           THE ONE LIMIT WORTH KNOWING: the vector source is maxzoom 14, so
           past that MapLibre overzooms — labels stay crisp, geometry gains no
           detail. Measured against the live endpoint 2026-09-03.

           CSP DID NEED SOMETHING, AND THIS COMMENT SAID IT DID NOT. That was
           the outage: the raster tiles came from `a.`…`d.` subdomains, the
           vector STYLE comes from the apex `basemaps.cartocdn.com`, and a CSP
           wildcard stands in for one or more labels — so
           `https://*.basemaps.cartocdn.com` never matched it. Our own policy
           refused the style, MapLibre got none, `load` never fired, and the
           map drew as bare parchment for every member for about nine hours.
           The apex is now its own entry in `MAP_TILE_HOSTS`
           (`src/lib/csp-routes.ts`) and `csp-routes.test.ts` resolves every
           URL built in this file against that list under real host-source
           rules. `worker-src blob:` really was already there for MapLibre.

           The tiles, glyphs and sprites the style then reaches for are all on
           `tiles.`, so the wildcard is doing real work alongside it.

           `voyager`, not `positron` and not `dark-matter`: positron is
           deliberately washed out and the chart treatment renders it as blank
           paper with faint smudges, and dark-matter is a hole cut in a cream
           cabinet. Voyager already has cream land, tan blocks and blue water —
           most of the way to a vintage chart before any filter. */
        style: CARTO_STYLE_URL,
      });
      /* The chart's scale bar ("1 mi"), from map.html's HUD. A ScaleControl
         rather than a drawing because it must re-derive with the zoom — a
         static "1 MI" rule is wrong at every zoom but one. */
      map.addControl(new maplibre.ScaleControl({ maxWidth: 96, unit: 'imperial' }), 'top-right');
      mapRef.current = map;
      const bump = () => setCameraTick((tick) => tick + 1);
      basemapDeadline = setTimeout(() => {
        if (!disposed) setFailed(true);
      }, BASEMAP_LOAD_DEADLINE_MS);
      map.on('load', () => {
        clearTimeout(basemapDeadline);
        setFailed(false);
        setReady(true);
        bump();
      });
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
      clearTimeout(basemapDeadline);
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

  // The night's route, plotted the pirate way (reference/map-treasure.html):
  // dashed ink through the evening's shows in start-time order. Ink brown,
  // never accent — the X's are the treasure, the line is the way. The colour
  // is read from the ink token at runtime rather than written here, because a
  // maplibre paint property cannot hold a var() and a hex in this file would
  // be a raw literal on a member route. The template's Leaflet stroke is
  // `1 9` dash at weight 2.2 with round caps — dots on a walked line — and
  // maplibre measures dasharray in line-widths, hence the ÷2.2.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const coordinates = layer === 'events' && events.length >= 2
      ? [...events]
          .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
          .map((pin) => [pin.longitude, pin.latitude] as [number, number])
      : [];
    const data = {
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'LineString' as const, coordinates },
    };
    const source = map.getSource('mmm-trail');
    if (source && 'setData' in source) {
      (source as { setData: (d: unknown) => void }).setData(data);
      return;
    }
    if (!coordinates.length) return;
    const ink = getComputedStyle(document.documentElement).getPropertyValue('--ink-3').trim();
    if (!ink) return;
    map.addSource('mmm-trail', { type: 'geojson', data });
    map.addLayer({
      id: 'mmm-trail',
      type: 'line',
      source: 'mmm-trail',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ink,
        'line-width': 2.2,
        'line-opacity': 0.75,
        'line-dasharray': [1 / 2.2, 9 / 2.2],
      },
    });
  }, [events, layer, ready]);

  // Location. The map STARTS where the member is, at the owner's direction
  // (2026-08-22: "Remove near me (should always start where you are)").
  //
  // ## This reverses a deliberate decision, and the reasoning is worth keeping
  //
  // Until now the ask belonged to a "Near me" button, because MOBILE.md's rule
  // is that a capability is asked for "at the moment of use and never on
  // launch" — and this map IS the launch surface (`WORKBENCH_PATH` is
  // `/app/map`, so `/` and every sign-in land here). The instruction overrides
  // that rule for this one capability, and the button it hung on is gone, so
  // there is no "moment of use" left to attach it to: starting where you are
  // has to happen on arrival or not at all.
  //
  // What is NOT reinstated is auto-opening the PRIMER SHEET. That was tried and
  // was a real bug: a scrim over the whole shell before the member had touched
  // anything, covering the navigation, caught by the e2e that proves the map
  // survives a module change by being unable to reach the nav at all. The OS
  // prompt is system chrome and covers none of our DOM, so asking the browser
  // directly is the version of this that does not re-create that.
  //
  // A denial or a timeout is still not an error state: the map opens on the
  // seeded county camera, which is exactly what it did before anyone answered.
  const [home, setHome] = useState<[number, number] | null>(null);
  /* Two effects lived here and went with the chip row (2026-08-22): one
     scrolled the pressed chip back into view after the row squeezed, one dropped
     the overflow fade at the end of the scroll. Both were real fixes to a
     control that no longer exists — the layer is the dock dial's now, and a dial
     names one station at full size with nothing to scroll. */

const flownHome = useRef(false);
  /**
   * Ask the browser where we are, and fly there when it answers.
   *
   * The flight is unconditional now, where it used to be an opt-in argument:
   * the only caller is the arrival effect below, and arriving IS the request.
   * (The argument existed because the old button opened a primer and returned
   * without moving the camera, so an accepted permission looked like a dead
   * button unless the flight was asked for explicitly.)
   *
   * `flownHome` still guards the artists layer's own flight, so a member who
   * has already panned somewhere is not yanked back by a late fix.
   */
  const requestPosition = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next: [number, number] = [position.coords.longitude, position.coords.latitude];
        setHome(next);
        /* Fly only if the canvas is actually up. When it is not, the flight is
           left to the deferred effect below rather than dropped on the floor —
           `flyTo` on a map that has not finished initialising does nothing and
           reports nothing. */
        if (flownHome.current || !mapRef.current?.loaded()) return;
        flownHome.current = true;
        mapRef.current.flyTo({ center: next, zoom: 12, duration: 800 });
      },
      // A refusal or a timeout leaves the seeded county camera up, which is the
      // same thing the map showed before anyone answered. Nothing to report.
      () => undefined,
      { timeout: 6000, maximumAge: 600000 },
    );
  }, []);

  /* ASKED ON ARRIVAL, NOT ON `ready` — and this used to be the other way round.
     The reason it was gated is real and is preserved: `getCurrentPosition` can
     answer from cache in a few milliseconds, and a `flyTo` on a map that has
     not finished initialising is dropped, which showed up as location being
     granted and the camera never moving. But that is a fact about the FLIGHT,
     and gating the ASK on it made the whole question conditional on a third
     party: `ready` is set by maplibre's `load`, which never fires while the
     raster source cannot reach the tile CDN. So a member behind a proxy that
     blocks cartocdn, or on a connection that drops the tiles, was never asked
     where they were at all — the seeded county camera stayed up and the app
     never put the question. The owner's instruction is that the map "should
     always start where you are", and a tile miss is not a reason to stop
     asking. Measured 2026-09-03 against the real worker: tiles answered
     ERR_CONNECTION_RESET, `load` never fired, and the ask count stayed 0
     through 40 seconds — which is also what had `e2e/mmm-shell.spec.ts`'s
     "the map asks for location itself" failing on main.

     The flight keeps the protection it always had, in the effect below. */
  const asked = useRef(false);
  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    requestPosition();
  }, [requestPosition]);

  /* The deferred half: an answer that arrived before the canvas was up still
     gets its flight, once. Without this, moving the ask earlier would trade a
     question nobody was asked for an answer nobody acted on. */
  useEffect(() => {
    if (!ready || !home || flownHome.current) return;
    flownHome.current = true;
    mapRef.current?.flyTo({ center: home, zoom: 12, duration: 800 });
  }, [ready, home]);

  /* Where the artists layer flies. Kept as its own callback because it falls
     back to the seeded camera when there is no position — which is what makes
     that layer's flight safe to run whether or not location was granted. */
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
      {/* The document's name. The shell does not render the route's children
          while the map is the surface, so the heading lives here — visually
          hidden, since the dock's knob already reads MAP — and only while the
          map IS the surface: the layer stays mounted under every pane, and two
          h1s in one document is the other way to mis-name a page. */}
      {active && <h1 className="sr-only">Map</h1>}
      <div className="mmm-map-canvas" ref={containerRef} />
      {/* The credit, HELD RATHER THAN TOGGLED (owner, 2026-08-25: "Tap the
          compass on map to show open maps badge and hide when let go").

          It cannot just be deleted: CARTO's basemap terms and OSM's ODbL both
          require the credit to be reachable, so a map with no way to it puts
          the tiles out of licence. The compass is now that way in — press it
          and the credit is there, let go and the chart is clean again.

          It reads while held and is not itself a control (`pointer-events:
          none`), so a finger that slides off the compass onto the badge does
          not get stuck on it. It also appears in the slot ABOVE the compass
          rather than in the compass's own place: the compass must not move
          under the finger that is holding it.

          The previous version was a tap-to-open disclosure on a ⓘ mark, and
          before that MapLibre's own `compact` AttributionControl — which was
          tried first and renders EXPANDED on load (measured 224px wide) and
          re-asserts that state whenever attributions update, so collapsing it
          once does not hold. */}
      {creditOpen && (
        <div aria-hidden="true" className="mmm-map-attrib">© OpenStreetMap · CARTO</div>
      )}
      {/* The torn deckled edge is GONE (owner, 2026-08-25: "Drop edge map
          design (doesn't fit with the view)"). It was map-treasure.html's
          `.char`: an undisplaced frame run through a fractal-noise
          displacement filter so the paper tore differently on every inch. The
          `#mmm-torn` SVG filter went with it — nothing else referenced it, and
          a filter definition left behind is one an unrelated element picks up
          by name later. */}
      {/* The compass rose — map-treasure.html's ornate eight-point card,
          replacing console-shell's simpler needle. It was decoration until the
          credit was hung on it; it is now the credit's control, so it is a
          button with a real label and the rose itself stays `aria-hidden`.

          Held, not toggled: down shows the credit, up or a finger sliding off
          hides it. Focus shows it too, which is what makes it operable from a
          keyboard without inventing a key handler — a tab to the compass reads
          the label and paints the credit. */}
      <button
        aria-label="Hold to show the map data credit"
        className="mmm-map-compass"
        onBlur={() => setCreditOpen(false)}
        onFocus={() => setCreditOpen(true)}
        onPointerCancel={() => setCreditOpen(false)}
        onPointerDown={() => setCreditOpen(true)}
        onPointerLeave={() => setCreditOpen(false)}
        onPointerUp={() => setCreditOpen(false)}
        type="button"
      >
        <svg aria-hidden="true" viewBox="0 0 80 80">
          <circle cx="40" cy="42" fill="none" r="26" stroke="currentColor" strokeWidth="1" />
          <circle cx="40" cy="42" fill="none" r="20.5" stroke="currentColor" strokeDasharray="1.6 3.2" strokeWidth="0.6" />
          <path d="M40 12 L44 42 L40 72 L36 42 Z" fill="currentColor" />
          <path d="M10 42 L40 38 L70 42 L40 46 Z" fill="currentColor" opacity="0.62" />
          <path d="M22 24 L42 40 L58 60 L38 44 Z" fill="currentColor" opacity="0.3" />
          <path d="M58 24 L42 44 L22 60 L38 40 Z" fill="currentColor" opacity="0.3" />
          <circle cx="40" cy="42" fill="var(--bg-surface)" r="3.4" stroke="currentColor" strokeWidth="1.4" />
          <text fill="currentColor" fontFamily="var(--font-mono)" fontSize="13" fontWeight="700" textAnchor="middle" x="40" y="9.5">N</text>
        </svg>
      </button>

      {placed.map((pin) => (
        <MapPin key={pin.key} onOpen={() => onOpenSheet(pin.target)} pin={pin} />
      ))}

      {active && (
        <>
          {/* The layer chips are GONE (2026-08-22): the dock's tuner tunes the
              layer now, which is the handoff's rule that there is one section
              control per screen and it is the dock's. A chip row above the map
              saying EVENTS · VENUES · ARTISTS and a dial below it reading
              "Events" are two controls for one value, and the pair drifts.

              `?layer=` is still what decides — this component already treats
              the URL as authoritative (`useEffect(() => setLayer(initialLayer))`
              below), so the dial pushes a route and the map follows. `setLayer`
              therefore has exactly one caller left: that effect. */}
          <div className="mmm-map-controls">
            {/* One row of chrome over the map, and it is the search bar.
                "Near me" is gone (2026-08-22): the map starts where you are, so
                a button whose whole job was to ask has nothing left to do, and
                the row it sat in went with it.

                The bar renders on EVERY layer now, where it used to be venues
                and artists only. That is what carrying the date picker requires
                — dates belong to events, so a bar that skipped the events layer
                would be a bar that never showed the control. Events are
                searchable by title, venue and city, which the layer already has
                in hand. */}
            <MapLayerSearch
              cities={cities}
              dates={layer === 'events'
                ? { onChange: setSelectedDays, selected: selectedDays }
                : null}
              events={events}
              layer={layer}
              onGoTo={goTo}
              onOpenSheet={onOpenSheet}
              venues={venues}
            />
            {/* The layer control, back on the map (MIDDLE ROAD, 2026-09-04).
                The comment above this block explains why it was removed: the
                dock's dial tuned the layer, and a chip row saying EVENTS ·
                VENUES · ARTISTS beside a dial reading "Events" is two controls
                for one value. The dial is gone, so the value has no control at
                all unless it is here — and the layer is the map's primary
                filter, not a preference.

                Still `?layer=`, still authoritative, still the route: these are
                real links from MMM_MAP_LAYERS and the effect below follows the
                URL exactly as it did for the dial. `setLayer` keeps its single
                caller. */}
            <MmmSectionStrip variant="brass" />
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
  dates,
  events,
  layer,
  onGoTo,
  onOpenSheet,
  venues,
}: {
  cities: MapArtistCity[];
  /** The date filter, on the events layer only — null elsewhere, because only
   *  an event has a date and the API is never sent `dates` for the other two. */
  dates: { onChange: (next: ReadonlySet<string>) => void; selected: ReadonlySet<string> } | null;
  events: MapEventPin[];
  layer: MapLayer;
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
    if (layer === 'events') {
      return events
        .filter((event) =>
          `${event.title} ${event.venueName ?? ''} ${event.venueCity ?? ''}`.toLowerCase().includes(trimmed))
        .map((event) => ({
          key: `event-${event.id}`,
          title: event.title,
          detail: [event.venueName, event.venueCity].filter(Boolean).join(' · '),
          lngLat: [event.longitude, event.latitude] as [number, number],
          // A show happens at an address, so the same zoom a venue result gets.
          zoom: 15,
          target: { kind: 'event', data: event } as MapSheetTarget,
        }));
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
  }, [cities, events, layer, trimmed, venues]);

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
        {/* Inside the field, at its right end — the owner's placement
            ("put a date selection inside search bar to the right that pops up
            calendar"). It is the last thing in the row rather than a sibling
            bar, so the two filters a member combines on this layer (a name and
            a date) read as one control. */}
        {dates && <MapDatePicker onChange={dates.onChange} selected={dates.selected} />}
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
              <Link className="mmm-search-result" href={`/app/music/discover?q=${encodeURIComponent(term.trim())}`}>
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

/**
 * The date filter — a button in the search field that opens a month calendar.
 *
 * Replaces the five day cards that used to sit above the map (2026-08-22, at the
 * owner's direction). Three things it does that the strip could not: reach a
 * date more than four days out, show the month a member is planning in, and
 * cost one line of chrome instead of two.
 *
 * The SET semantics are unchanged and are the reason this is not a native
 * `<input type="date">`: DS8's map document requires a Friday and a Sunday with
 * nothing between them to be a legal selection, and a native date input is one
 * value. `type="date"` also renders as a platform picker that cannot show which
 * days are already chosen.
 */
function MapDatePicker({
  onChange,
  selected,
}: {
  onChange: (next: ReadonlySet<string>) => void;
  selected: ReadonlySet<string>;
}) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState(() => new Date());
  const popRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const month = monthGrid(anchor);

  /* Click-out and Escape both close, and the pointerdown is captured for the
     same reason the search results use it: a drag that begins on the map should
     close the popover before the map starts panning under it. */
  useEffect(() => {
    if (!open) return undefined;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (popRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    }
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="mmm-datepick">
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        className="mmm-datepick-trigger"
        onClick={() => setOpen((current) => !current)}
        ref={buttonRef}
        type="button"
      >
        <span aria-hidden="true" className="mmm-datepick-glyph">▤</span>
        {/* The readout is the button's accessible name as well as its label, so
            a screen reader hears the current filter rather than "button". */}
        <span className="mmm-datepick-value">{describeDayKeys(selected)}</span>
      </button>

      {open && (
        <div
          aria-label="Filter by date"
          className="mmm-datepick-pop"
          ref={popRef}
          role="dialog"
        >
          <div className="mmm-datepick-head">
            <button
              aria-label="Previous month"
              className="mmm-datepick-page"
              onClick={() => setAnchor((current) => shiftMonth(current, -1))}
              type="button"
            >
              ‹
            </button>
            <span className="mmm-datepick-month">{month.title}</span>
            <button
              aria-label="Next month"
              className="mmm-datepick-page"
              onClick={() => setAnchor((current) => shiftMonth(current, 1))}
              type="button"
            >
              ›
            </button>
          </div>

          <div className="mmm-datepick-dows" aria-hidden="true">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((dow, index) => (
              <span key={`${dow}${index}`}>{dow}</span>
            ))}
          </div>

          <div className="mmm-datepick-grid" role="group">
            {month.weeks.flat().map((cell) => (
              <button
                aria-pressed={selected.has(cell.key)}
                className="mmm-datepick-day"
                data-outside={cell.inMonth ? undefined : 'true'}
                data-today={cell.isToday ? 'true' : undefined}
                /* Past days are drawn and disabled rather than blanked: the
                   events endpoint refuses them, so a past cell is a control
                   that returns nothing by construction — but a calendar with
                   holes in it stops reading as a calendar. */
                disabled={cell.isPast}
                key={cell.key}
                onClick={() => onChange(toggleDay(selected, cell.key))}
                type="button"
              >
                {cell.day}
              </button>
            ))}
          </div>

          <div className="mmm-datepick-foot">
            <button
              className="mmm-datepick-clear"
              disabled={selected.size === 0}
              onClick={() => onChange(new Set())}
              type="button"
            >
              Any day
            </button>
            <button
              className="mmm-datepick-done"
              onClick={() => { setOpen(false); buttonRef.current?.focus(); }}
              type="button"
            >
              Done
            </button>
          </div>
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
        aria-label={`${count} artist${count === 1 ? '' : 's'} from ${city}`}
        /* A city of origin, not an address — drawn dashed and softer so it is
           not mistaken for a venue's door or for a cluster of pins. */
        className="mmm-bubble mmm-bubble-city"
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
        <span className="mmm-pin-tag">{venue.name}</span>
        {/* Two hand-cut strokes (map-treasure.html), jittered a few degrees by
            a hash of the venue's own id — deterministic, so the same X leans
            the same way on every load, like ink that dried once. */}
        <span
          aria-hidden="true"
          className="mmm-pin-x"
          style={{ transform: `rotate(${(([...venue.id].reduce((h, c) => h + c.charCodeAt(0), 0) * 137) % 17) - 8}deg)` }}
        >
          <i />
          <i />
        </span>
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

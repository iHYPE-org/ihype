'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
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
  }, [active, genre, layer, ready]);

  // Debounced against the camera tick: a pan fires `move` per frame, and one
  // request per frame would be a self-inflicted denial of service.
  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => { void load(); }, 220);
    return () => window.clearTimeout(timer);
  }, [active, cameraTick, load]);

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

      {placed.map((pin) => (
        <MapPin key={pin.key} onOpen={() => onOpenSheet(pin.target)} pin={pin} />
      ))}

      {active && (
        <>
          <div className="mmm-map-controls">
            <div className="mmm-control-row">
              {LAYERS.map((entry) => (
                <button
                  aria-pressed={layer === entry.id}
                  className="mmm-chip"
                  key={entry.id}
                  onClick={() => setLayer(entry.id)}
                  type="button"
                >
                  {entry.label}
                </button>
              ))}
              <div aria-hidden="true" className="mmm-control-divider" />
              {MAP_SCOPES.map((entry) => (
                <button
                  aria-pressed={scope === entry}
                  className="mmm-chip"
                  key={entry}
                  onClick={() => setScope(entry)}
                  type="button"
                >
                  {entry.charAt(0).toUpperCase() + entry.slice(1)}
                </button>
              ))}
            </div>
            <div className="mmm-control-row">
              {GENRES.map((entry) => (
                <button
                  aria-pressed={genre === entry}
                  className="mmm-chip mmm-chip-genre"
                  key={entry}
                  onClick={() => setGenre(entry)}
                  type="button"
                >
                  {entry}
                </button>
              ))}
            </div>
          </div>
          <div className="mmm-result-line" role="status">
            {failed
              ? 'The map could not load. Everything else still works.'
              : paused
                ? 'Map lookups are paused right now — try again shortly.'
                : resultLine(total, layer, genre)}
          </div>
        </>
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

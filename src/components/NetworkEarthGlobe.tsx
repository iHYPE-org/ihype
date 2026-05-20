'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { RequestLocation } from '@/lib/request-location';

export type NetworkEarthVenue = {
  id: string;
  slug: string;
  name: string;
  addressLine1: string | null;
  hoursText: string | null;
  city: string | null;
  stateRegion: string | null;
  country: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type NetworkEarthRouteStop = {
  id: string;
  title: string;
  href?: string | null;
  venueName: string;
  venueSlug?: string | null;
  city: string | null;
  stateRegion: string | null;
  country: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  startsAtLabel: string;
  timing: 'past' | 'live' | 'upcoming';
};

type NetworkEarthGlobeProps = {
  badge?: string;
  title: string;
  description: string;
  routeLabel: string;
  emptyRouteLabel: string;
  venues: NetworkEarthVenue[];
  routeStops: NetworkEarthRouteStop[];
  viewerLocation: RequestLocation | null;
};

type GlobeScope = 'zip' | 'regional' | 'national' | 'global';
type ZoomPhase = 'space' | 'approach' | 'zip';

function cleanValue(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeValue(value?: string | null) {
  return cleanValue(value)?.toLowerCase() ?? '';
}

function projectLongitude(longitude: number) {
  return ((longitude + 180) / 360) * 100;
}

function projectLatitude(latitude: number) {
  return ((90 - latitude) / 180) * 100;
}

function getOrbitTransform(phase: ZoomPhase, focusX: number, focusY: number) {
  const shiftX = (50 - focusX) * 0.58;
  const shiftY = (50 - focusY) * 0.42;

  if (phase === 'space') {
    return 'translate(0%, 0%) scale(0.56) rotate(-14deg)';
  }

  if (phase === 'approach') {
    return `translate(${(shiftX * 0.28).toFixed(3)}%, ${(shiftY * 0.28).toFixed(3)}%) scale(0.86) rotate(-6deg)`;
  }

  return `translate(${shiftX.toFixed(3)}%, ${shiftY.toFixed(3)}%) scale(1.28) rotate(0deg)`;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function calculateDistanceKm(
  left: Pick<NetworkEarthVenue | NetworkEarthRouteStop | RequestLocation, 'latitude' | 'longitude'>,
  right: Pick<RequestLocation, 'latitude' | 'longitude'>
) {
  if (
    left.latitude == null ||
    left.longitude == null ||
    right.latitude == null ||
    right.longitude == null
  ) {
    return Number.POSITIVE_INFINITY;
  }

  const earthRadiusKm = 6371;
  const latitudeDelta = toRadians(right.latitude - left.latitude);
  const longitudeDelta = toRadians(right.longitude - left.longitude);
  const latitudeA = toRadians(left.latitude);
  const latitudeB = toRadians(right.latitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatViewerLocation(location: RequestLocation | null) {
  if (!location) {
    return 'Location unavailable';
  }

  const parts = [location.postalCode, location.city, location.stateRegion].filter(Boolean);
  return parts.length ? parts.join(' - ') : [location.city, location.country].filter(Boolean).join(', ') || 'Location unavailable';
}

function formatVenueAddress(venue: NetworkEarthVenue) {
  const addressParts = [venue.addressLine1, venue.city, venue.stateRegion, venue.postalCode]
    .map((value) => cleanValue(value))
    .filter(Boolean);

  if (addressParts.length) {
    return addressParts.join(', ');
  }

  return [venue.city, venue.country].filter(Boolean).join(', ') || 'Address not posted yet.';
}

function formatRouteLocation(stop: NetworkEarthRouteStop) {
  return [stop.venueName, stop.city, stop.stateRegion || stop.country, stop.postalCode]
    .filter(Boolean)
    .join(' - ');
}

function getScopeLabel(scope: GlobeScope, viewerLocation: RequestLocation | null) {
  if (scope === 'zip') return viewerLocation?.postalCode ? `ZIP ${viewerLocation.postalCode}` : 'Nearby';
  if (scope === 'regional') return 'Regional';
  if (scope === 'national') return 'National';
  return 'Global';
}

function matchesScope(
  item: Pick<NetworkEarthVenue | NetworkEarthRouteStop, 'city' | 'stateRegion' | 'country' | 'postalCode' | 'latitude' | 'longitude'>,
  scope: GlobeScope,
  viewerLocation: RequestLocation | null
) {
  if (!viewerLocation) {
    return scope === 'global';
  }

  if (scope === 'zip') {
    if (viewerLocation.postalCode && item.postalCode === viewerLocation.postalCode) {
      return true;
    }

    return calculateDistanceKm(item, viewerLocation) <= 80;
  }

  if (scope === 'regional') {
    if (viewerLocation.stateRegion && normalizeValue(item.stateRegion) === normalizeValue(viewerLocation.stateRegion)) {
      return true;
    }

    if (viewerLocation.city && normalizeValue(item.city) === normalizeValue(viewerLocation.city)) {
      return true;
    }

    return calculateDistanceKm(item, viewerLocation) <= 420;
  }

  if (scope === 'national') {
    if (viewerLocation.country && normalizeValue(item.country) === normalizeValue(viewerLocation.country)) {
      return true;
    }

    return calculateDistanceKm(item, viewerLocation) <= 2400;
  }

  return true;
}

function getDefaultScope(viewerLocation: RequestLocation | null): GlobeScope {
  if (viewerLocation?.postalCode || (viewerLocation?.latitude != null && viewerLocation?.longitude != null)) {
    return 'zip';
  }

  if (viewerLocation?.stateRegion || viewerLocation?.city) {
    return 'regional';
  }

  if (viewerLocation?.country) {
    return 'national';
  }

  return 'global';
}

export function NetworkEarthGlobe({
  badge = 'Earth API',
  title,
  description,
  routeLabel,
  emptyRouteLabel,
  venues,
  routeStops,
  viewerLocation
}: NetworkEarthGlobeProps) {
  const [activeScope, setActiveScope] = useState<GlobeScope>(() => getDefaultScope(viewerLocation));
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [zoomPhase, setZoomPhase] = useState<ZoomPhase>('space');
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const mappedVenues = useMemo(
    () => venues.filter((venue) => venue.latitude != null && venue.longitude != null),
    [venues]
  );

  const orderedVenues = useMemo(() => {
    if (!viewerLocation) {
      return mappedVenues;
    }

    return [...mappedVenues].sort((left, right) => {
      const leftDistance = calculateDistanceKm(left, viewerLocation);
      const rightDistance = calculateDistanceKm(right, viewerLocation);
      return leftDistance - rightDistance;
    });
  }, [mappedVenues, viewerLocation]);

  const visibleVenues = useMemo(() => {
    const scoped = orderedVenues.filter((venue) => matchesScope(venue, activeScope, viewerLocation));
    return scoped.length ? scoped : orderedVenues.slice(0, 14);
  }, [activeScope, orderedVenues, viewerLocation]);

  const visibleRouteStops = useMemo(() => {
    const mappedStops = routeStops.filter((stop) => stop.latitude != null && stop.longitude != null);
    const scoped = mappedStops.filter((stop) => matchesScope(stop, activeScope, viewerLocation));
    return scoped.length ? scoped : mappedStops.slice(0, 10);
  }, [activeScope, routeStops, viewerLocation]);

  useEffect(() => {
    if (!visibleVenues.length) {
      setSelectedVenueId(null);
      return;
    }

    if (!selectedVenueId || !visibleVenues.some((venue) => venue.id === selectedVenueId)) {
      setSelectedVenueId(visibleVenues[0]?.id ?? null);
    }
  }, [selectedVenueId, visibleVenues]);

  useEffect(() => {
    if (!visibleRouteStops.length) {
      setSelectedRouteId(null);
      return;
    }

    if (!selectedRouteId || !visibleRouteStops.some((stop) => stop.id === selectedRouteId)) {
      setSelectedRouteId(visibleRouteStops[0]?.id ?? null);
    }
  }, [selectedRouteId, visibleRouteStops]);

  const selectedVenue = visibleVenues.find((venue) => venue.id === selectedVenueId) ?? visibleVenues[0] ?? null;
  const selectedRouteStop = visibleRouteStops.find((stop) => stop.id === selectedRouteId) ?? visibleRouteStops[0] ?? null;
  const focusPoint =
    selectedRouteStop ??
    selectedVenue ??
    (viewerLocation?.latitude != null && viewerLocation?.longitude != null ? viewerLocation : null);

  const focusX = focusPoint?.longitude != null ? projectLongitude(focusPoint.longitude) : 50;
  const focusY = focusPoint?.latitude != null ? projectLatitude(focusPoint.latitude) : 50;

  useEffect(() => {
    setZoomPhase('space');

    const approachTimer = window.setTimeout(() => setZoomPhase('approach'), 180);
    const diveTimer = window.setTimeout(() => setZoomPhase('zip'), 1180);

    return () => {
      window.clearTimeout(approachTimer);
      window.clearTimeout(diveTimer);
    };
  }, [activeScope, selectedVenue?.id, selectedRouteStop?.id]);

  const orbitStyle = useMemo(
    () =>
      ({
        transform: getOrbitTransform(zoomPhase, focusX, focusY)
      }) satisfies CSSProperties,
    [focusX, focusY, zoomPhase]
  );

  const routePolyline = useMemo(() => {
    if (visibleRouteStops.length < 2) {
      return '';
    }

    return visibleRouteStops
      .map((stop) => `${projectLongitude(stop.longitude!)},${projectLatitude(stop.latitude!)}`)
      .join(' ');
  }, [visibleRouteStops]);

  const nearbyVenueCount =
    viewerLocation?.postalCode
      ? orderedVenues.filter((venue) => venue.postalCode === viewerLocation.postalCode).length
      : 0;

  return (
    <section className="panel map-panel earth-globe-panel">
      <div className="map-panel-header">
        <div>
          <div className="badge">{badge}</div>
          <h3>{title}</h3>
          <p className="kicker">{description}</p>
        </div>
        <div className="scope-toggle">
          {(['zip', 'regional', 'national', 'global'] as const).map((scope) => (
            <button
              className={scope === activeScope ? 'scope-pill active' : 'scope-pill'}
              key={scope}
              onClick={() => setActiveScope(scope)}
              type="button"
            >
              {getScopeLabel(scope, viewerLocation)}
            </button>
          ))}
        </div>
      </div>

      {isMobile && (
        <div className="globe-mobile-fallback">
          <p className="meta" style={{ marginBottom: '0.75rem' }}>Venue network</p>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.5rem' }}>
            {venues.slice(0, 8).map((v) => (
              <li key={v.id}>
                <Link href={`/venues/${v.slug}`} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.04)' }}>
                  <span>{v.name}</span>
                  <span className="meta">{[v.city, v.stateRegion].filter(Boolean).join(', ')}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="map-layout">
        <div className={`activity-map-stage earth-globe-stage globe-phase-${zoomPhase}`} role="img" aria-label={title}>
          <div className="activity-map-stars" />
          <div className="activity-map-dust" />
          <div className="activity-map-grid" />
          <div className="activity-map-orbit" style={orbitStyle}>
            <div className="activity-globe-shell">
              <div className="activity-globe-atmosphere" />
              <div className="activity-globe-sphere">
                <span className="activity-globe-latitude latitude-a" />
                <span className="activity-globe-latitude latitude-b" />
                <span className="activity-globe-latitude latitude-c" />
                <span className="activity-globe-longitude longitude-a" />
                <span className="activity-globe-longitude longitude-b" />
                <span className="activity-globe-longitude longitude-c" />
                <span className="activity-globe-continent continent-a" />
                <span className="activity-globe-continent continent-b" />
                <span className="activity-globe-continent continent-c" />

                {routePolyline ? (
                  <svg className="earth-globe-path-layer" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <polyline className="earth-globe-path-line" points={routePolyline} />
                  </svg>
                ) : null}

                {viewerLocation?.latitude != null && viewerLocation?.longitude != null ? (
                  <div
                    className="earth-globe-viewer-marker"
                    style={{
                      left: `${projectLongitude(viewerLocation.longitude)}%`,
                      top: `${projectLatitude(viewerLocation.latitude)}%`
                    }}
                  >
                    <span>{viewerLocation.postalCode ?? 'You'}</span>
                  </div>
                ) : null}

                {visibleVenues.map((venue) => {
                  const isNearby = Boolean(
                    viewerLocation &&
                      venue.postalCode &&
                      viewerLocation.postalCode &&
                      venue.postalCode === viewerLocation.postalCode
                  );

                  return (
                    <Link
                      aria-label={`Open venue page for ${venue.name}`}
                      className={[
                        'earth-globe-venue',
                        venue.id === selectedVenue?.id ? 'active' : '',
                        isNearby ? 'nearby' : ''
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      href={`/venues/${venue.slug}`}
                      key={venue.id}
                      onFocus={() => setSelectedVenueId(venue.id)}
                      onMouseEnter={() => setSelectedVenueId(venue.id)}
                      style={{
                        left: `${projectLongitude(venue.longitude!)}%`,
                        top: `${projectLatitude(venue.latitude!)}%`
                      }}
                      title={`${venue.name}\n${formatVenueAddress(venue)}\n${venue.hoursText || 'Hours not posted yet.'}`}
                    >
                      <span>{venue.postalCode ?? venue.city ?? venue.name}</span>
                    </Link>
                  );
                })}

                {visibleRouteStops.map((stop) => (
                  <button
                    aria-label={`${stop.title} at ${stop.venueName}`}
                    className={`earth-globe-route-marker ${stop.timing}${stop.id === selectedRouteStop?.id ? ' active' : ''}`}
                    key={stop.id}
                    onClick={() => setSelectedRouteId(stop.id)}
                    style={{
                      left: `${projectLongitude(stop.longitude!)}%`,
                      top: `${projectLatitude(stop.latitude!)}%`
                    }}
                    type="button"
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="map-caption">
            {visibleVenues.length} venues in view · {visibleRouteStops.length} route stop{visibleRouteStops.length === 1 ? '' : 's'} visible
          </div>
        </div>

        <aside className="panel map-detail earth-globe-detail">
          <div className="earth-globe-detail-stack">
            <div className="earth-globe-detail-card">
              <span className="badge">Viewer ZIP</span>
              <h3>{formatViewerLocation(viewerLocation)}</h3>
              <p className="meta">
                {viewerLocation
                  ? nearbyVenueCount
                    ? `${nearbyVenueCount} venue${nearbyVenueCount === 1 ? '' : 's'} match your detected ZIP. Zoom out to browse farther away.`
                    : 'This globe starts from your detected request location, then lets you zoom out across the wider network.'
                  : 'Location lookup was unavailable for this request, so the globe starts from the broader network view.'}
              </p>
            </div>

            <div className="earth-globe-detail-card">
              <span className="badge">Nearby venue</span>
              {selectedVenue ? (
                <>
                  <h3>{selectedVenue.name}</h3>
                  <p className="meta">{formatVenueAddress(selectedVenue)}</p>
                  <p className="meta">{selectedVenue.hoursText || 'Hours not posted yet.'}</p>
                  <Link className="button small secondary" href={`/venues/${selectedVenue.slug}`}>
                    Open venue page
                  </Link>
                </>
              ) : (
                <p className="meta">No mapped venue markers are available right now.</p>
              )}
            </div>

            <div className="earth-globe-detail-card">
              <span className="badge">{routeLabel}</span>
              {selectedRouteStop ? (
                <div className="earth-globe-route-spotlight">
                  <strong>{selectedRouteStop.title}</strong>
                  <p>{formatRouteLocation(selectedRouteStop)}</p>
                  <p>{selectedRouteStop.startsAtLabel}</p>
                  {selectedRouteStop.href ? (
                    <Link className="button small secondary" href={selectedRouteStop.href}>
                      Open show
                    </Link>
                  ) : null}
                </div>
              ) : null}

              {visibleRouteStops.length ? (
                <div className="earth-globe-route-list">
                  {visibleRouteStops.map((stop) =>
                    stop.href ? (
                      <Link
                        className={stop.id === selectedRouteStop?.id ? 'earth-globe-route-item active' : 'earth-globe-route-item'}
                        href={stop.href}
                        key={stop.id}
                        onFocus={() => setSelectedRouteId(stop.id)}
                        onMouseEnter={() => setSelectedRouteId(stop.id)}
                      >
                        <strong>{stop.title}</strong>
                        <span>{formatRouteLocation(stop)}</span>
                        <span>{stop.startsAtLabel}</span>
                      </Link>
                    ) : (
                      <button
                        className={stop.id === selectedRouteStop?.id ? 'earth-globe-route-item active' : 'earth-globe-route-item'}
                        key={stop.id}
                        onClick={() => setSelectedRouteId(stop.id)}
                        onFocus={() => setSelectedRouteId(stop.id)}
                        onMouseEnter={() => setSelectedRouteId(stop.id)}
                        type="button"
                      >
                        <strong>{stop.title}</strong>
                        <span>{formatRouteLocation(stop)}</span>
                        <span>{stop.startsAtLabel}</span>
                      </button>
                    )
                  )}
                </div>
              ) : (
                <p className="meta">{emptyRouteLabel}</p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

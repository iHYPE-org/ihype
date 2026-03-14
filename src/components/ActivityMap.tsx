'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { ActivityMapPoint, ActivityScopeCard, ScopeKey } from '@/lib/activity-stats';

type ActivityMapProps = {
  points: ActivityMapPoint[];
  scopes: ActivityScopeCard[];
};

type GeoFocusResponse = {
  pointId: string | null;
};

type ZoomPhase = 'space' | 'approach' | 'zip';

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

export function ActivityMap({ points, scopes }: ActivityMapProps) {
  const [activeScope, setActiveScope] = useState<ScopeKey>('global');
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [preferredPointId, setPreferredPointId] = useState<string | null>(null);
  const [hasManualSelection, setHasManualSelection] = useState(false);
  const [zoomPhase, setZoomPhase] = useState<ZoomPhase>('space');

  const visiblePoints = useMemo(
    () => points.filter((point) => point.scopes.includes(activeScope)),
    [activeScope, points]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadGeoFocus() {
      try {
        const response = await fetch('/api/geo-focus', {
          cache: 'no-store',
          credentials: 'same-origin'
        });

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as GeoFocusResponse;
        if (!cancelled && data.pointId) {
          setPreferredPointId(data.pointId);
        }
      } catch {
        // Keep the default hotspot ordering when a private focus point is unavailable.
      }
    }

    void loadGeoFocus();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setHasManualSelection(false);
  }, [activeScope]);

  const autoSelectedPointId =
    preferredPointId && visiblePoints.some((point) => point.id === preferredPointId)
      ? preferredPointId
      : (visiblePoints[0]?.id ?? null);

  useEffect(() => {
    if (!visiblePoints.length) {
      if (selectedPointId !== null) {
        setSelectedPointId(null);
      }
      return;
    }

    const hasValidSelection = selectedPointId && visiblePoints.some((point) => point.id === selectedPointId);

    if (!hasManualSelection || !hasValidSelection) {
      setSelectedPointId(autoSelectedPointId);
    }
  }, [autoSelectedPointId, hasManualSelection, selectedPointId, visiblePoints]);

  const selectedPoint = visiblePoints.find((point) => point.id === selectedPointId) ?? visiblePoints[0] ?? null;
  const focusX = selectedPoint ? projectLongitude(selectedPoint.longitude) : 50;
  const focusY = selectedPoint ? projectLatitude(selectedPoint.latitude) : 50;

  useEffect(() => {
    setZoomPhase('space');

    const approachTimer = window.setTimeout(() => setZoomPhase('approach'), 180);
    const diveTimer = window.setTimeout(() => setZoomPhase('zip'), 1180);

    return () => {
      window.clearTimeout(approachTimer);
      window.clearTimeout(diveTimer);
    };
  }, [activeScope, selectedPoint?.id]);

  const orbitStyle = useMemo(
    () =>
      ({
        transform: getOrbitTransform(zoomPhase, focusX, focusY)
      }) satisfies CSSProperties,
    [focusX, focusY, zoomPhase]
  );

  return (
    <section className="panel map-panel">
      <div className="map-panel-header">
        <div>
          <div className="badge">Activity Globe</div>
          <h3>Orbit from the full network down to public zip activity.</h3>
          <p className="kicker">
            Nearby focus uses private request context under the hood, but the interface only ever shows public venue
            and show hotspots.
          </p>
        </div>
        <div className="scope-toggle">
          {scopes.map((scope) => (
            <button
              className={scope.key === activeScope ? 'scope-pill active' : 'scope-pill'}
              key={scope.key}
              onClick={() => setActiveScope(scope.key)}
              type="button"
            >
              {scope.label}
            </button>
          ))}
        </div>
      </div>

      <div className="map-layout">
        <div className={`activity-map-stage globe-phase-${zoomPhase}`} role="img" aria-label={`Activity globe filtered to ${activeScope} scope`}>
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
                {visiblePoints.map((point) => {
                  const left = projectLongitude(point.longitude);
                  const top = projectLatitude(point.latitude);
                  const pulseSize = Math.max(16, Math.min(34, 12 + point.liveCount * 4 + point.venueCount * 3));

                  return (
                    <button
                      aria-label={`${point.label}: ${point.venueCount} venues and ${point.showCount} shows`}
                      className={point.id === selectedPointId ? 'map-marker active' : 'map-marker'}
                      key={point.id}
                      onClick={() => {
                        setHasManualSelection(true);
                        setSelectedPointId(point.id);
                      }}
                      style={{
                        left: `${left}%`,
                        top: `${top}%`,
                        width: `${pulseSize}px`,
                        height: `${pulseSize}px`
                      }}
                      type="button"
                    >
                      <span>{point.postalCode}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="map-caption">Visible public zip layers: {visiblePoints.length}</div>
        </div>

        <aside className="map-detail panel">
          {selectedPoint ? (
            <>
              <div className="badge">Zip {selectedPoint.postalCode}</div>
              <h3>{selectedPoint.city}{selectedPoint.stateRegion ? `, ${selectedPoint.stateRegion}` : ''}</h3>
              <p className="meta">{selectedPoint.country} public hotspot</p>

              <div className="map-detail-stats">
                <div className="stat"><strong>{selectedPoint.venueCount}</strong>Venues</div>
                <div className="stat"><strong>{selectedPoint.showCount}</strong>Shows</div>
                <div className="stat"><strong>{selectedPoint.liveCount}</strong>Live now</div>
                <div className="stat"><strong>{selectedPoint.totalHype}</strong>Hype</div>
              </div>

              <div className="map-detail-block">
                <h4>Venues here</h4>
                {selectedPoint.venueNames.length ? (
                  <ul className="launch-list compact">
                    {selectedPoint.venueNames.map((name) => <li key={name}>{name}</li>)}
                  </ul>
                ) : (
                  <p className="meta">No venue profiles pinned here yet.</p>
                )}
              </div>

              <div className="map-detail-block">
                <h4>Shows here</h4>
                {selectedPoint.showTitles.length ? (
                  <ul className="launch-list compact">
                    {selectedPoint.showTitles.map((title) => <li key={title}>{title}</li>)}
                  </ul>
                ) : (
                  <p className="meta">No shows pinned here yet.</p>
                )}
              </div>
            </>
          ) : (
            <div className="empty">No mapped activity exists for this scope yet.</div>
          )}
        </aside>
      </div>
    </section>
  );
}

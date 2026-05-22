'use client';

import React, { useState } from 'react';

export type HypeHeatmapCity = {
  name: string;
  x: number;
  y: number;
  hype: number;
  venuesAsking: number;
  hot?: boolean;
  velocity?: number;
  velocityTrend?: 'up' | 'down' | 'stable';
  genreAffinityScore?: number;
  signalBreakdown?: {
    taste: number | null;
    geo: number | null;
    momentum: number;
    collab: number | null;
  };
};

export type HypeHeatmapVenuePing = {
  id: string;
  name: string;
  city: string;
  capacity: number;
  statusLabel: string;
  signal: 'urgent' | 'warm' | 'new';
};

type Props = {
  cities: HypeHeatmapCity[];
  venuePings: HypeHeatmapVenuePing[];
  suggestedRoute?: string;
  routeOrder?: string[];
  artistGenres?: string[];
};

const DEMO_CITIES: HypeHeatmapCity[] = [
  { name: 'Chicago',   x: .55, y: .42, hype: 1247, venuesAsking: 3, hot: true,  velocityTrend: 'up',     genreAffinityScore: 0.82, signalBreakdown: { taste: 0.78, geo: 0.91, momentum: 0.85, collab: 0.6  } },
  { name: 'Brooklyn',  x: .81, y: .42, hype: 892,  venuesAsking: 4, hot: true,  velocityTrend: 'up',     genreAffinityScore: 0.75, signalBreakdown: { taste: 0.65, geo: 0.88, momentum: 0.72, collab: 0.5  } },
  { name: 'Austin',    x: .45, y: .74, hype: 602,  venuesAsking: 3, hot: true,  velocityTrend: 'stable', genreAffinityScore: 0.61, signalBreakdown: { taste: 0.55, geo: 0.7,  momentum: 0.6,  collab: null } },
  { name: 'LA',        x: .13, y: .56, hype: 441,  venuesAsking: 2, hot: false, velocityTrend: 'down',   genreAffinityScore: 0.22, signalBreakdown: { taste: 0.3,  geo: 0.45, momentum: 0.35, collab: 0.2  } },
  { name: 'Seattle',   x: .10, y: .28, hype: 218,  venuesAsking: 1, hot: false, velocityTrend: 'stable', genreAffinityScore: 0.44, signalBreakdown: { taste: null, geo: 0.5,  momentum: 0.4,  collab: null } },
  { name: 'Nashville', x: .62, y: .58, hype: 334,  venuesAsking: 2, hot: false, velocityTrend: 'up',     genreAffinityScore: 0.68, signalBreakdown: { taste: 0.6,  geo: 0.6,  momentum: 0.55, collab: 0.45 } },
  { name: 'Denver',    x: .32, y: .44, hype: 189,  venuesAsking: 1, hot: false, velocityTrend: 'down',   genreAffinityScore: 0.18, signalBreakdown: { taste: 0.2,  geo: 0.35, momentum: 0.25, collab: null } },
];

const DEMO_PINGS: HypeHeatmapVenuePing[] = [
  { id: 'v1', name: 'Music Hall of Williamsburg', city: 'Brooklyn',  capacity: 550, statusLabel: 'wants Aug 8–10',  signal: 'urgent' },
  { id: 'v2', name: 'Empty Bottle',               city: 'Chicago',   capacity: 200, statusLabel: 'open Sep',        signal: 'warm'   },
  { id: 'v3', name: 'Mohawk',                     city: 'Austin',    capacity: 520, statusLabel: 'reach out',       signal: 'new'    },
  { id: 'v4', name: 'Teragram Ballroom',          city: 'LA',        capacity: 650, statusLabel: 'holding Aug 22',  signal: 'urgent' },
];

const SIGNAL_COLOR: Record<string, string> = {
  urgent: '#ff5029',
  warm: '#ffb84a',
  new: '#22e5d4',
};

const BREAKDOWN_COLORS: Record<string, string> = {
  taste: '#b983ff',
  geo: '#22e5d4',
  momentum: '#ffb84a',
  collab: '#ff5029',
};

function usProjection(x: number, y: number): { px: string; py: string } {
  const lngMin = -125, lngMax = -67;
  const latMin = 25, latMax = 50;
  const lng = x * 360 - 180;
  const lat = 90 - y * 180;
  const px = `${((lng - lngMin) / (lngMax - lngMin)) * 100}%`;
  const py = `${((latMax - lat) / (latMax - latMin)) * 100}%`;
  return { px, py };
}

function cityToSvgCoords(x: number, y: number): { cx: number; cy: number } {
  const lngMin = -125, lngMax = -67, latMin = 25, latMax = 50;
  const lng = x * 360 - 180;
  const lat = 90 - y * 180;
  const cx = ((lng - lngMin) / (lngMax - lngMin)) * 800;
  const cy = ((latMax - lat) / (latMax - latMin)) * 450;
  return { cx, cy };
}

// Suppress unused variable warning — suggestedRoute is kept for backward compat
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function HypeHeatmap({ cities, venuePings, suggestedRoute: _suggestedRoute, routeOrder, artistGenres }: Props) {
  const activeCities = cities.length > 0 ? cities : DEMO_CITIES;
  const activePings = venuePings.length > 0 ? venuePings : DEMO_PINGS;
  const [selected, setSelected] = useState<string | null>(null);
  const [showGenreOverlay, setShowGenreOverlay] = useState(false);

  const maxHype = Math.max(...activeCities.map(c => c.hype));

  const selectedCity = activeCities.find(c => c.name === selected);
  const cityPings = activePings.filter(p => p.city === selected);

  // Build route polyline points in SVG coordinate space
  const routePoints: { cx: number; cy: number; name: string }[] = [];
  if (routeOrder && routeOrder.length >= 2) {
    for (const name of routeOrder) {
      const city = activeCities.find(c => c.name === name);
      if (city) {
        routePoints.push({ ...cityToSvgCoords(city.x, city.y), name });
      }
    }
  }
  const polylinePoints = routePoints.map(p => `${p.cx},${p.cy}`).join(' ');

  return (
    <div style={{ padding: '24px 32px 32px' }}>
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.18em', color: 'var(--ink-3)', marginBottom: 10 }}>
          ● HYPE HEATMAP · TOUR PLANNER · ARTIST VIEW
        </div>
        <h1 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 42, letterSpacing: '-.03em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>
          Hype Map
        </h1>
        <p style={{ fontFamily: 'var(--f-b)', fontSize: 14, color: 'var(--ink-2)', marginTop: 10, maxWidth: 560, lineHeight: 1.5 }}>
          Where your fans are loudest. Hot cities show venue interest — click to see who&apos;s asking.
        </p>
      </div>

      {/* Controls bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        {routeOrder && routeOrder.length >= 2 && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', border: '1px solid rgba(255,184,74,.3)', borderRadius: 99, background: 'rgba(255,184,74,.06)' }}>
            <span style={{ fontFamily: 'var(--f-m)', fontSize: 9, letterSpacing: '.16em', color: '#ffb84a' }}>OPTIMAL ROUTE</span>
            <span style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 13, color: 'var(--ink)' }}>
              {routeOrder.join(' → ')}
            </span>
          </div>
        )}
        {artistGenres && artistGenres.length > 0 && (
          <button
            type="button"
            onClick={() => setShowGenreOverlay(o => !o)}
            style={{
              padding: '5px 11px', borderRadius: 99, fontSize: '0.72rem',
              background: showGenreOverlay ? 'rgba(34,229,212,0.15)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${showGenreOverlay ? 'rgba(34,229,212,0.4)' : 'rgba(255,255,255,0.12)'}`,
              color: showGenreOverlay ? '#22e5d4' : 'inherit', cursor: 'pointer',
            }}
          >
            {showGenreOverlay ? '◉' : '○'} Genre affinity
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, alignItems: 'start' }}>
        {/* Map */}
        <div style={{ position: 'relative', width: '100%', paddingBottom: '55%', border: '1px solid var(--line)', borderRadius: 12, background: 'var(--bg-2)', overflow: 'hidden' }}>

          {/* SVG layer: heat blobs + pulse rings + route polyline + genre rings + US outline */}
          <svg
            viewBox="0 0 800 450"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
            preserveAspectRatio="none"
          >
            <defs>
              <filter id="heat-blur" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="18" />
              </filter>
            </defs>

            <style>{`
              .pulse-ring { animation: heat-pulse 2s ease-out infinite; }
              @keyframes heat-pulse {
                0%   { opacity: 0.5; }
                100% { opacity: 0; transform: scale(2.5); }
              }
            `}</style>

            <rect width="800" height="450" fill="transparent" />

            {/* US outline */}
            <path
              d="M 60 80 L 80 60 L 120 55 L 180 50 L 240 52 L 300 50 L 380 48 L 450 50 L 520 52 L 580 55 L 630 70 L 650 90 L 660 120 L 650 150 L 640 180 L 630 220 L 620 260 L 590 290 L 570 320 L 540 340 L 500 350 L 460 360 L 420 355 L 380 360 L 340 350 L 300 340 L 260 330 L 220 340 L 190 350 L 160 345 L 140 330 L 120 310 L 100 280 L 80 250 L 65 220 L 55 180 L 50 140 L 55 100 Z"
              fill="rgba(255,255,255,.03)" stroke="var(--line-2)" strokeWidth="1.5"
            />

            {/* Heat blobs — rendered below everything else */}
            <g filter="url(#heat-blur)">
              {activeCities.map(city => {
                const { cx, cy } = cityToSvgCoords(city.x, city.y);
                const r = 40 + (city.hype / maxHype) * 60;
                const fill = city.hot ? 'rgba(255,62,154,0.18)' : 'rgba(127,179,255,0.12)';
                return <circle key={`blob-${city.name}`} cx={cx} cy={cy} r={r} fill={fill} />;
              })}
            </g>

            {/* Route polyline — above blobs, below city dots */}
            {routePoints.length >= 2 && (
              <g>
                <polyline
                  points={polylinePoints}
                  stroke="rgba(255,184,74,0.6)"
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                  fill="none"
                />
                {routePoints.map(p => (
                  <circle key={`wp-${p.name}`} cx={p.cx} cy={p.cy} r={2.5} fill="#ffb84a" opacity={0.8} />
                ))}
              </g>
            )}

            {/* Pulse rings for hot / trending-up cities */}
            {activeCities.map(city => {
              const isPulsing = city.hot === true || city.velocityTrend === 'up';
              if (!isPulsing) return null;
              const { cx, cy } = cityToSvgCoords(city.x, city.y);
              const r = 6 + (city.hype / maxHype) * 18;
              return (
                <g key={`pulse-${city.name}`}>
                  <circle
                    cx={cx} cy={cy} r={r * 1.4}
                    fill="none" stroke="rgba(255,62,154,0.4)" strokeWidth="1.5"
                    className="pulse-ring"
                    style={{ transformOrigin: `${cx}px ${cy}px`, transformBox: 'fill-box' as React.CSSProperties['transformBox'], animationDelay: '0s' }}
                  />
                  <circle
                    cx={cx} cy={cy} r={r * 1.4}
                    fill="none" stroke="rgba(255,62,154,0.4)" strokeWidth="1.5"
                    className="pulse-ring"
                    style={{ transformOrigin: `${cx}px ${cy}px`, transformBox: 'fill-box' as React.CSSProperties['transformBox'], animationDelay: '0.75s' }}
                  />
                </g>
              );
            })}

            {/* Genre affinity highlight rings */}
            {showGenreOverlay && activeCities.map(city => {
              if ((city.genreAffinityScore ?? 0) < 0.6) return null;
              const { cx, cy } = cityToSvgCoords(city.x, city.y);
              const r = 6 + (city.hype / maxHype) * 18;
              return (
                <circle
                  key={`affinity-${city.name}`}
                  cx={cx} cy={cy} r={r + 5}
                  fill="none" stroke="#22e5d4" strokeWidth="1.5" opacity={0.7}
                />
              );
            })}
          </svg>

          {/* City buttons — absolutely positioned over SVG */}
          {activeCities.map(city => {
            const { px, py } = usProjection(city.x, city.y);
            const r = 6 + (city.hype / maxHype) * 18;
            const isSelected = selected === city.name;
            const isHot = city.hot;
            const affinityScore = city.genreAffinityScore ?? 1;
            const isDimmed = showGenreOverlay && affinityScore < 0.3;

            const trendSymbol =
              city.velocityTrend === 'up'     ? { char: '↑', color: '#22c55e' } :
              city.velocityTrend === 'down'   ? { char: '↓', color: 'rgba(255,255,255,0.3)' } :
                                                { char: '→', color: 'rgba(255,255,255,0.2)' };

            return (
              <button
                key={city.name}
                type="button"
                onClick={() => setSelected(isSelected ? null : city.name)}
                style={{
                  position: 'absolute',
                  left: px, top: py,
                  transform: 'translate(-50%, -50%)',
                  width: r * 2, height: r * 2, borderRadius: '50%',
                  background: isHot
                    ? `rgba(255,62,154,${0.15 + (city.hype / maxHype) * 0.45})`
                    : `rgba(127,179,255,${0.12 + (city.hype / maxHype) * 0.35})`,
                  border: `2px solid ${isSelected ? 'var(--accent)' : isHot ? 'rgba(255,62,154,.5)' : 'rgba(127,179,255,.3)'}`,
                  cursor: 'pointer',
                  zIndex: isSelected ? 10 : 2,
                  transition: 'border-color .15s, transform .15s, opacity .15s',
                  boxShadow: isSelected
                    ? '0 0 0 3px rgba(255,80,41,.2)'
                    : isHot ? `0 0 ${r}px rgba(255,62,154,.25)` : 'none',
                  opacity: isDimmed ? 0.25 : 1,
                }}
              >
                <div style={{
                  position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
                  marginTop: 4, whiteSpace: 'nowrap', fontFamily: 'var(--f-m)', fontSize: 9,
                  letterSpacing: '.1em', color: isSelected ? 'var(--accent)' : isHot ? '#ff3e9a' : 'var(--ink-3)',
                  pointerEvents: 'none', textAlign: 'center', lineHeight: 1.3,
                }}>
                  {city.name}
                  <br />
                  <span style={{ color: trendSymbol.color, fontSize: 9 }}>{trendSymbol.char}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Sidebar: selected city detail + venue pings + legend */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Selected city detail */}
          {selectedCity && (
            <div style={{ padding: '16px', border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg-2)' }}>
              <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 16, color: 'var(--ink)', marginBottom: 4 }}>{selectedCity.name}</div>
              <div style={{ display: 'flex', gap: 20, marginBottom: 12 }}>
                <div>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 9, letterSpacing: '.14em', color: 'var(--ink-3)', marginBottom: 3 }}>HYPE</div>
                  <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 20, color: '#ff3e9a' }}>{selectedCity.hype.toLocaleString()}</div>
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 9, letterSpacing: '.14em', color: 'var(--ink-3)', marginBottom: 3 }}>VENUES ASKING</div>
                  <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 20, color: '#ffb84a' }}>{selectedCity.venuesAsking}</div>
                </div>
              </div>

              {/* Confidence breakdown */}
              {selectedCity.signalBreakdown && (
                <div style={{ marginBottom: 14, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 9, letterSpacing: '.14em', color: 'var(--ink-3)', marginBottom: 8 }}>SIGNAL CONFIDENCE</div>
                  {(['taste', 'geo', 'momentum', 'collab'] as const).map(key => {
                    const val = selectedCity.signalBreakdown![key];
                    return (
                      <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <div style={{ fontFamily: 'var(--f-m)', fontSize: 9, letterSpacing: '.1em', color: 'var(--ink-3)', width: 60, textTransform: 'uppercase' }}>{key}</div>
                        <div style={{ width: 120, height: 4, background: 'var(--line)', borderRadius: 2, flexShrink: 0, overflow: 'hidden' }}>
                          {val !== null && (
                            <div style={{ width: `${val * 100}%`, height: '100%', background: BREAKDOWN_COLORS[key], borderRadius: 2, transition: 'width .3s' }} />
                          )}
                        </div>
                        <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-2)', width: 30, textAlign: 'right' }}>
                          {val !== null ? `${Math.round(val * 100)}%` : '—'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {cityPings.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {cityPings.map(ping => (
                    <div key={ping.id} style={{ padding: '10px 12px', border: `1px solid ${SIGNAL_COLOR[ping.signal]}40`, borderRadius: 8, borderLeft: `3px solid ${SIGNAL_COLOR[ping.signal]}` }}>
                      <div style={{ fontFamily: 'var(--f-d)', fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>{ping.name}</div>
                      <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-3)', marginTop: 3 }}>{ping.capacity} cap · {ping.statusLabel}</div>
                      <div style={{ fontFamily: 'var(--f-m)', fontSize: 9, letterSpacing: '.12em', color: SIGNAL_COLOR[ping.signal], marginTop: 4, textTransform: 'uppercase' }}>{ping.signal}</div>
                    </div>
                  ))}
                </div>
              )}
              {cityPings.length === 0 && (
                <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-3)' }}>No venue pings yet for {selectedCity.name}.</div>
              )}
            </div>
          )}

          {/* All venue pings */}
          <div style={{ border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg-2)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', fontFamily: 'var(--f-m)', fontSize: 10, letterSpacing: '.14em', color: 'var(--ink-3)' }}>
              VENUE PINGS · {activePings.length}
            </div>
            {activePings.map(ping => (
              <div key={ping.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid var(--line)', borderLeft: `3px solid ${SIGNAL_COLOR[ping.signal]}` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--f-d)', fontWeight: 600, fontSize: 13, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ping.name}</div>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-3)', marginTop: 2 }}>{ping.city} · {ping.statusLabel}</div>
                </div>
                <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-2)' }}>{ping.capacity}</div>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: SIGNAL_COLOR[ping.signal], flexShrink: 0 }} />
              </div>
            ))}
          </div>

          {/* Legend */}
          <div style={{ padding: '12px 14px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg-2)' }}>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: 9, letterSpacing: '.14em', color: 'var(--ink-3)', marginBottom: 8 }}>SIGNAL</div>
            {(['urgent', 'warm', 'new'] as const).map(s => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: SIGNAL_COLOR[s] }} />
                <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-2)', textTransform: 'capitalize' }}>{s}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import React, { memo, useState } from 'react';
import { SplitBar } from '@/components/SplitBar';
import { useRouter } from 'next/navigation';
import type { WorkbenchData } from '@/types/workbench';
import { IcDot, IcCheck, IcArrow, IcQR } from './icons';
import { StatCard } from './primitives';

// Neighborhood fake coordinate mappings for Chicago SVG (viewBox 0 0 600 400)
const NEIGHBORHOOD_COORDS: Record<string, { x: number; y: number; label: string }> = {
  'Wicker Park':    { x: 170, y: 195, label: 'Wicker Park' },
  'Logan Square':   { x: 120, y: 170, label: 'Logan Square' },
  'Lincoln Park':   { x: 290, y: 145, label: 'Lincoln Park' },
  'River North':    { x: 280, y: 205, label: 'River North' },
  'Hyde Park':      { x: 330, y: 320, label: 'Hyde Park' },
  'Pilsen':         { x: 195, y: 290, label: 'Pilsen' },
  'Andersonville':  { x: 285, y: 95,  label: 'Andersonville' },
  'Bridgeport':     { x: 240, y: 310, label: 'Bridgeport' },
};

const STATUS_COLORS: Record<string, string> = {
  'TONIGHT':   '#22e5d4',
  'THIS WEEK': '#b983ff',
  'UPCOMING':  '#ffb84a',
  'NEAR SOLD': '#ff3e9a',
};

// Map show to a neighborhood based on venue name heuristic
function venueToNeighborhood(venue: string): { x: number; y: number } {
  const v = venue.toLowerCase();
  if (v.includes('wicker') || v.includes('empty bottle') || v.includes('subterranean')) return NEIGHBORHOOD_COORDS['Wicker Park'];
  if (v.includes('logan') || v.includes('hairpin') || v.includes('owl')) return NEIGHBORHOOD_COORDS['Logan Square'];
  if (v.includes('lincoln') || v.includes('lincoln park') || v.includes('vic')) return NEIGHBORHOOD_COORDS['Lincoln Park'];
  if (v.includes('river north') || v.includes('house of blues') || v.includes('underground')) return NEIGHBORHOOD_COORDS['River North'];
  if (v.includes('hyde') || v.includes('promontory')) return NEIGHBORHOOD_COORDS['Hyde Park'];
  if (v.includes('pilsen') || v.includes('thalia') || v.includes('co-prosperity')) return NEIGHBORHOOD_COORDS['Pilsen'];
  if (v.includes('anderson') || v.includes('hopleaf') || v.includes('big chicks')) return NEIGHBORHOOD_COORDS['Andersonville'];
  if (v.includes('bridgeport') || v.includes('maria')) return NEIGHBORHOOD_COORDS['Bridgeport'];
  // Distribute by show id hash
  const keys = Object.keys(NEIGHBORHOOD_COORDS);
  const idx = venue.charCodeAt(0) % keys.length;
  return NEIGHBORHOOD_COORDS[keys[idx]];
}

function ChicagoMap({ shows }: { shows: WorkbenchData['shows'] }) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const hoveredShow = shows.find(s => s.id === hoveredId) ?? null;
  const hoveredCoords = hoveredShow ? venueToNeighborhood(hoveredShow.venue) : null;

  return (
    <div style={{ position: 'relative', width: '100%', borderRadius: 14, overflow: 'hidden', border: '1px solid var(--line)', background: '#0a0f1a' }}>
      <svg
        viewBox="0 0 600 400"
        style={{ display: 'block', width: '100%' }}
        aria-label="Chicago neighborhood map with show pins"
      >
        {/* Sky / lake gradient background */}
        <defs>
          <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0a0f1a" />
            <stop offset="100%" stopColor="#0d1525" />
          </linearGradient>
          <linearGradient id="lakeGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#091828" />
            <stop offset="100%" stopColor="#0b2040" />
          </linearGradient>
          <radialGradient id="pinGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#22e5d4" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#22e5d4" stopOpacity="0" />
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
            <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <style>{`
            @keyframes pulse { 0%,100%{r:8;opacity:1} 50%{r:13;opacity:.4} }
            .pin-pulse { animation: pulse 1.8s ease-in-out infinite; }
          `}</style>
        </defs>

        {/* Background */}
        <rect width="600" height="400" fill="url(#skyGrad)" />

        {/* Lake Michigan (right side) */}
        <polygon
          points="390,0 600,0 600,400 390,400 410,340 430,260 415,180 400,100 390,40"
          fill="url(#lakeGrad)"
          opacity="0.9"
        />
        <text x="510" y="200" fill="#1a4060" fontFamily="sans-serif" fontSize="11" textAnchor="middle" opacity="0.7" fontStyle="italic">Lake Michigan</text>

        {/* Chicago city outline */}
        <polygon
          points="60,30 390,30 390,40 400,100 415,180 430,260 410,340 390,380 60,380"
          fill="#111825"
          stroke="#22e5d480"
          strokeWidth="1.5"
        />

        {/* Grid lines (streets) */}
        {[80,120,160,200,240,280,320,360].map(y => (
          <line key={`h${y}`} x1="60" y1={y} x2="390" y2={y} stroke="#ffffff08" strokeWidth="0.5" />
        ))}
        {[100,140,180,220,260,300,340,380].map(x => (
          <line key={`v${x}`} x1={x} y1="30" x2={x} y2="380" stroke="#ffffff08" strokeWidth="0.5" />
        ))}

        {/* Major roads */}
        <line x1="60" y1="210" x2="390" y2="210" stroke="#1e3050" strokeWidth="1.5" />
        <line x1="220" y1="30" x2="220" y2="380" stroke="#1e3050" strokeWidth="1.5" />
        <line x1="60" y1="130" x2="390" y2="130" stroke="#1e3050" strokeWidth="1" />

        {/* Neighborhood zones */}
        {Object.entries(NEIGHBORHOOD_COORDS).map(([name, c]) => (
          <g key={name}>
            <circle cx={c.x} cy={c.y} r="38" fill="#ffffff04" stroke="#ffffff08" strokeWidth="0.5" />
            <text x={c.x} y={c.y + 52} textAnchor="middle" fill="#ffffff25" fontSize="8.5" fontFamily="sans-serif" letterSpacing="0.5">{name}</text>
          </g>
        ))}

        {/* Downtown marker */}
        <text x="280" y="220" textAnchor="middle" fill="#ffffff18" fontSize="10" fontFamily="sans-serif" letterSpacing="1">THE LOOP</text>

        {/* Show pins */}
        {shows.map((s) => {
          const coords = venueToNeighborhood(s.venue);
          const color = STATUS_COLORS[s.status] ?? '#b983ff';
          const isTonight = s.status === 'TONIGHT';
          const isHovered = hoveredId === s.id;
          return (
            <g
              key={s.id}
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHoveredId(s.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              {/* Glow halo */}
              <circle cx={coords.x} cy={coords.y} r="18" fill={color} opacity="0.08" />
              {/* Pulse ring for TONIGHT */}
              {isTonight && (
                <circle
                  className="pin-pulse"
                  cx={coords.x}
                  cy={coords.y}
                  r="8"
                  fill="none"
                  stroke={color}
                  strokeWidth="1.5"
                  opacity="0.6"
                />
              )}
              {/* Pin shadow */}
              <circle cx={coords.x} cy={coords.y} r={isHovered ? 9 : 7} fill={color} opacity="0.25" filter="url(#glow)" />
              {/* Pin dot */}
              <circle
                cx={coords.x}
                cy={coords.y}
                r={isHovered ? 7 : 5}
                fill={color}
                filter="url(#glow)"
              />
              <circle cx={coords.x} cy={coords.y} r={isHovered ? 3 : 2} fill="#fff" opacity="0.9" />
            </g>
          );
        })}

        {/* Empty state overlay */}
        {shows.length === 0 && (
          <text x="225" y="210" textAnchor="middle" fill="#ffffff60" fontSize="13" fontFamily="sans-serif">
            No shows mapped yet — be the first to list one in Chicago
          </text>
        )}
      </svg>

      {/* Popover card */}
      {hoveredShow && hoveredCoords && (() => {
        const color = STATUS_COLORS[hoveredShow.status] ?? '#b983ff';
        // Compute rough % position for CSS
        const xPct = (hoveredCoords.x / 600) * 100;
        const yPct = (hoveredCoords.y / 400) * 100;
        const left = xPct > 60 ? undefined : `${xPct}%`;
        const right = xPct > 60 ? `${100 - xPct}%` : undefined;
        const top = yPct > 60 ? undefined : `${yPct}%`;
        const bottom = yPct > 60 ? `${100 - yPct}%` : undefined;
        return (
          <div style={{
            position: 'absolute',
            left, right, top, bottom,
            transform: 'translate(-50%, -110%)',
            background: '#0f1a2e',
            border: `1px solid ${color}60`,
            borderRadius: 10,
            padding: '10px 14px',
            minWidth: 190,
            boxShadow: `0 4px 24px rgba(0,0,0,.6), 0 0 12px ${color}30`,
            pointerEvents: 'none',
            zIndex: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
              <span style={{ fontFamily: 'var(--f-m)', fontSize: 11, letterSpacing: '.12em', color }}>{hoveredShow.status}</span>
            </div>
            <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 15, color: '#fff', lineHeight: 1.2, marginBottom: 4 }}>{hoveredShow.name}</div>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: '#8899aa', marginBottom: 2 }}>{hoveredShow.venue}</div>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: '#8899aa', marginBottom: 8 }}>{hoveredShow.date} · {hoveredShow.time}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 18, color: '#fff' }}>${hoveredShow.price}</span>
              <span style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: '#8899aa' }}>♡ {hoveredShow.hype} hype</span>
            </div>
          </div>
        );
      })()}

      {/* Legend */}
      <div style={{
        position: 'absolute', bottom: 12, right: 12,
        background: 'rgba(0,0,0,.72)',
        border: '1px solid rgba(255,255,255,.08)',
        borderRadius: 8,
        padding: '8px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
      }}>
        {Object.entries(STATUS_COLORS).map(([label, color]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
            <span style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: '#aabbcc', letterSpacing: '.1em' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function VenueLeaderboard({ shows }: { shows: WorkbenchData['shows'] }) {
  // Group shows by venue, sum hype
  const venueMap: Record<string, { hype: number; showCount: number }> = {};
  for (const s of shows) {
    if (!venueMap[s.venue]) venueMap[s.venue] = { hype: 0, showCount: 0 };
    venueMap[s.venue].hype += s.hype;
    venueMap[s.venue].showCount += 1;
  }
  const ranked = Object.entries(venueMap)
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.hype - a.hype)
    .slice(0, 5);

  const RANK_COLORS = ['#f5d060', '#b0b7c3', '#c47722', '#8899aa', '#8899aa'];

  return (
    <div style={{ marginTop: 24, border: '1px solid var(--line)', borderRadius: 12, background: 'var(--bg-2)', overflow: 'hidden' }}>
      <div style={{ padding: '13px 18px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 15, color: 'var(--ink)', letterSpacing: '-.01em' }}>
          🏆 Venue Leaderboard · This Month
        </div>
      </div>
      {ranked.length < 2 ? (
        <div style={{ padding: '20px 18px', fontFamily: 'var(--f-m)', fontSize: 13, color: 'var(--ink-3)', textAlign: 'center' }}>
          More venues coming soon — list your show to appear here
        </div>
      ) : (
        <div>
          {ranked.map((v, i) => (
            <div key={v.name} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '12px 18px',
              borderBottom: i < ranked.length - 1 ? '1px solid var(--line)' : 'none',
              background: i === 0 ? 'rgba(245,208,96,.04)' : 'transparent',
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                border: `1.5px solid ${RANK_COLORS[i]}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 12,
                color: RANK_COLORS[i], flexShrink: 0,
              }}>
                {i + 1}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 14, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {v.name}
                </div>
                <div style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-3)', marginTop: 2, letterSpacing: '.04em' }}>
                  {v.showCount} {v.showCount === 1 ? 'show' : 'shows'}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 15, color: RANK_COLORS[i] }}>
                🔥 <span>{v.hype.toLocaleString()}</span>
                <span style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-3)', fontWeight: 400, letterSpacing: '.08em', marginLeft: 2 }}>HYPE</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RsvpButton({ showId }: { showId: string }) {
  const [going, setGoing] = useState(false);
  const [loading, setLoading] = useState(false);
  return (
    <button
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        try {
          const res = await fetch(`/api/shows/${showId}/rsvp`, { method: 'POST' });
          if (res.ok) { const d = await res.json(); setGoing(d.going); }
        } finally { setLoading(false); }
      }}
      style={{
        padding: '9px 14px', borderRadius: 6, fontFamily: 'var(--f-m)', fontSize: 12, fontWeight: 600,
        letterSpacing: '.04em', cursor: loading ? 'default' : 'pointer',
        border: going ? '1px solid rgba(34,229,212,.4)' : '1px solid rgba(34,229,212,.3)',
        background: going ? 'rgba(34,229,212,.15)' : 'transparent',
        color: going ? '#22e5d4' : 'var(--ink-2)',
      }}
    >
      {going ? '✓ Going' : 'Going?'}
    </button>
  );
}

export const ViewTickets = memo(function ViewTickets({ data }: { data: WorkbenchData }) {
  const router = useRouter();
  const [tab, setTab] = useState<'browse' | 'mine' | 'selling' | 'scan' | 'map'>('browse');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'CHICAGO' | 'THIS WEEK' | 'UNDER $20'>('CHICAGO');
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [reportStatus, setReportStatus] = useState<'idle' | 'sending' | 'done'>('idle');

  async function submitReport(showId: string) {
    if (!reportReason.trim()) return;
    setReportStatus('sending');
    try {
      await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityType: 'show', entityId: showId, reason: reportReason.trim() }),
      });
      setReportStatus('done');
      setTimeout(() => { setReportingId(null); setReportReason(''); setReportStatus('idle'); }, 1500);
    } catch {
      setReportStatus('idle');
    }
  }
  const tabs = [
    ['browse','Browse'],
    ['map','Map'],
    ['mine','My tickets'],
    ['selling','Selling'],
    ['scan','Scan / verify'],
  ] as const;

  return (
    <>
    <div style={{ padding: '24px 32px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 22, gap: 24 }}>
        <div>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, letterSpacing: '.18em', color: '#22e5d4', marginBottom: 10 }}>
            ● {data.showsTonight} TONIGHT · NO SCALPERS · 45/45/10 SPLIT
          </div>
          <h1 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 42, letterSpacing: '-.03em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Live Events</h1>
          <p style={{ fontFamily: 'var(--f-b)', fontSize: 14, color: 'var(--ink-2)', marginTop: 10, maxWidth: 560, lineHeight: 1.5 }}>
            Every show in real rooms — browse, buy, hold, transfer, verify. <strong>45/45/10</strong> split: artist · venue · referrer. No platform fee, ever.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 8, flexShrink: 0 }}>
          {tabs.map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} style={{
              padding: '7px 12px', borderRadius: 5, fontFamily: 'var(--f-m)', fontSize: 13, letterSpacing: '.04em', border: 'none', cursor: 'pointer',
              background: tab === k ? 'var(--bg-3)' : 'transparent',
              color: tab === k ? 'var(--ink)' : 'var(--ink-3)',
            }}>{l}</button>
          ))}
        </div>
      </div>

      {tab === 'browse' && (() => {
        const filteredShows = data.shows.filter(s => {
          if (activeFilter === 'CHICAGO') return true; // city not available on WbShow — show all
          if (activeFilter === 'UNDER $20') return s.price < 20;
          if (activeFilter === 'THIS WEEK') return s.status === 'TONIGHT' || s.status === 'UPCOMING';
          return true;
        });
        return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {(['ALL CITIES', 'CHICAGO', 'THIS WEEK', 'UNDER $20'] as const).map((f) => {
              const filterKey = f === 'ALL CITIES' ? 'ALL' : f as typeof activeFilter;
              const isActive = activeFilter === filterKey;
              return (
                <button key={f} onClick={() => setActiveFilter(filterKey)} style={{ padding: '7px 12px', border: '1px solid var(--line)', borderRadius: 99, fontFamily: 'var(--f-m)', fontSize: 12, letterSpacing: '.12em', cursor: 'pointer', background: isActive ? 'var(--bg-4)' : 'var(--bg-2)', color: isActive ? 'var(--ink)' : 'var(--ink-2)', borderColor: isActive ? 'var(--line-2)' : 'var(--line)' }}>{f}</button>
              );
            })}
            <span style={{ flex: 1 }} />
            <button style={{ padding: '7px 12px', border: '1px solid var(--line)', borderRadius: 99, fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-2)', background: 'var(--bg-2)', cursor: 'pointer' }}>Sort · by HYPE ↓</button>
          </div>
          {filteredShows.length === 0 && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 16, padding: '64px 32px', textAlign: 'center',
              border: '1px dashed var(--line-2)', borderRadius: 14, background: 'var(--bg-2)',
            }}>
              <div style={{ fontSize: 52 }}>🎪</div>
              <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 24, letterSpacing: '-.02em', color: 'var(--ink)' }}>No shows yet in your city</div>
              <div style={{ fontFamily: 'var(--f-b)', fontSize: 14, color: 'var(--ink-2)', maxWidth: '36ch', lineHeight: 1.55 }}>
                Be the first to list a show in Chicago. Artists and venues keep 45% each — no platform fee, ever.
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button
                  onClick={() => router.push('/home')}
                  style={{ padding: '10px 20px', border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'var(--f-m)', fontSize: 13, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#fff', background: 'linear-gradient(135deg, var(--accent), var(--pink, #ff3e9a))' }}
                >
                  Create a show
                </button>
                <button
                  style={{ padding: '10px 20px', border: '1px solid var(--line-2)', borderRadius: 8, cursor: 'pointer', fontFamily: 'var(--f-m)', fontSize: 13, color: 'var(--ink-2)', background: 'none', letterSpacing: '.04em' }}
                  onClick={() => setActiveFilter('ALL')}
                >
                  Widen filter
                </button>
              </div>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
            {filteredShows.map(s => {
              const pct = s.capacity > 0 ? (s.sold / s.capacity) * 100 : 0;
              const statusColor = s.status === 'TONIGHT' ? '#22e5d4' : s.status === 'NEAR SOLD' ? '#ffb84a' : '#b983ff';
              const color = ['#ff5029','#b983ff','#22e5d4','#ff3e9a'][data.shows.indexOf(s) % 4];
              return (
                <div key={s.id} style={{ border: '1px solid var(--line)', borderRadius: 12, background: 'var(--bg-2)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ height: 140, position: 'relative', overflow: 'hidden', background: `linear-gradient(135deg, ${color}, ${color}80)` }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 40%, rgba(0,0,0,.4) 100%)' }} />
                    <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'rgba(0,0,0,.55)', borderRadius: 99, fontFamily: 'var(--f-m)', fontSize: 12, color: '#fff', letterSpacing: '.14em' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor, display: 'inline-block' }} /> {s.status}
                    </div>
                    <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', background: 'rgba(0,0,0,.55)', borderRadius: 99, fontFamily: 'var(--f-m)', fontSize: 12, color: '#fff' }}>
                        ♡ {s.hype} HYPE
                      </div>
                      {s.sold > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', background: 'rgba(34,229,212,.18)', borderRadius: 99, fontFamily: 'var(--f-m)', fontSize: 11, color: '#22e5d4', border: '1px solid rgba(34,229,212,.3)' }}>
                          👥 {s.sold} going
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 22, letterSpacing: '-.02em', lineHeight: 1.05, color: 'var(--ink)' }}>{s.name}</div>
                    <div style={{ fontFamily: 'var(--f-m)', fontSize: 13, color: 'var(--ink-2)', letterSpacing: '.06em' }}>{s.venue}</div>
                    <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.06em' }}>{s.date} · {s.time}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                      <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,.06)', borderRadius: 2, position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', inset: 0, width: `${pct}%`, background: pct > 85 ? '#ffb84a' : '#22e5d4', borderRadius: 2 }} />
                      </div>
                      <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)' }}>{s.sold} / {s.capacity}</div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                      <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 26, letterSpacing: '-.02em', color: 'var(--ink)' }}>${s.price}</div>
                      <RsvpButton showId={s.id} />
                      <button onClick={() => router.push(`/shows/${s.id}`)} style={{ padding: '9px 16px', background: 'var(--ink)', color: 'var(--bg)', borderRadius: 6, fontFamily: 'var(--f-m)', fontSize: 12, fontWeight: 600, letterSpacing: '.04em', border: 'none', cursor: 'pointer' }}>Get ticket →</button>
                      <button
                        aria-label="Share show"
                        onClick={async () => {
                          const url = `${window.location.origin}/shows/${s.id}`;
                          if (navigator.share) {
                            try { await navigator.share({ title: s.name, text: `${s.name} at ${s.venue}`, url }); } catch {}
                          } else {
                            await navigator.clipboard.writeText(url).catch(() => {});
                          }
                        }}
                        style={{ background: 'none', border: '1px solid var(--line)', borderRadius: 6, cursor: 'pointer', color: 'var(--ink-2)', padding: '7px 10px', display: 'flex', alignItems: 'center' }}
                        title="Share show"
                      >
                        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                        </svg>
                      </button>
                    </div>
                    <div style={{ paddingTop: 8, marginTop: 2, borderTop: '1px solid var(--line)' }}>
                      <SplitBar total={s.price} compact height={6} style={{ marginBottom: 6 }} />
                      <button
                        onClick={() => { setReportingId(s.id); setReportReason(''); setReportStatus('idle'); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontFamily: 'var(--f-m)', fontSize: 11, padding: '2px 4px', opacity: 0.6 }}
                        title="Report this show"
                      >
                        ⚑ Report
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <VenueLeaderboard shows={data.shows} />
        </div>
        );
      })()}

      {tab === 'map' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.14em' }}>
            SHOWING {data.shows.length} {data.shows.length === 1 ? 'SHOW' : 'SHOWS'} ACROSS CHICAGO · HOVER PINS FOR DETAILS
          </div>
          <ChicagoMap shows={data.shows} />
        </div>
      )}

      {tab === 'mine' && (
        <div>
          {data.tickets.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.16em', marginBottom: 10 }}>NEXT UP</div>
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 200px', gap: 32, padding: '24px 28px',
                border: '1px solid var(--line)', borderRadius: 12,
                background: 'linear-gradient(135deg, rgba(255,80,41,.15) 0%, transparent 60%), var(--bg-2)',
              }}>
                <div>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: '#22e5d4', letterSpacing: '.14em', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <IcDot c="#22e5d4" s={7} /> CONFIRMED · DOORS 7:30 PM
                  </div>
                  <h2 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 32, letterSpacing: '-.025em', margin: '10px 0 4px', color: 'var(--ink)' }}>
                    {data.tickets[0].showName}
                  </h2>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-2)', letterSpacing: '.06em' }}>{data.tickets[0].date}</div>
                  <div style={{ display: 'flex', gap: 30, marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--line)' }}>
                    {[['SEAT', data.tickets[0].seat], ['PAID', `$${data.tickets[0].price}`], ['ENTRY CODE', data.tickets[0].code]].map(([l, v]) => (
                      <div key={l}>
                        <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.16em', marginBottom: 6 }}>{l}</div>
                        <div style={{ fontFamily: l === 'ENTRY CODE' ? 'var(--f-m)' : 'var(--f-d)', fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{v}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 22, flexWrap: 'wrap' }}>
                    <button style={{ padding: '9px 16px', background: 'var(--ink)', color: 'var(--bg)', borderRadius: 6, fontFamily: 'var(--f-m)', fontSize: 12, fontWeight: 600, letterSpacing: '.04em', border: 'none', cursor: 'pointer' }}>Show at door →</button>
                    {['Transfer', 'Add to Wallet'].map(l => (
                      <button key={l} style={{ padding: '9px 14px', border: '1px solid var(--line-2)', borderRadius: 6, fontFamily: 'var(--f-m)', fontSize: 12, letterSpacing: '.04em', color: 'var(--ink)', background: 'none', cursor: 'pointer' }}>{l}</button>
                    ))}
                    <button style={{ padding: '9px 14px', border: '1px solid rgba(255,80,41,.3)', color: '#ff5029', borderRadius: 6, fontFamily: 'var(--f-m)', fontSize: 12, letterSpacing: '.04em', background: 'none', cursor: 'pointer' }}>Request refund</button>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                  <div style={{ padding: 14, background: 'var(--ink)', color: 'var(--bg)', borderRadius: 8 }}><IcQR s={140} /></div>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.06em', textAlign: 'center', maxWidth: 140 }}>Signed by iHYPE · scan with venue app</div>
                </div>
              </div>
            </div>
          )}
          <div style={{ border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg-2)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>All my tickets</div>
              <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.04em' }}>{data.tickets.length} active</div>
            </div>
            {data.tickets.map(tk => (
              <div key={tk.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderBottom: '1px solid var(--line)' }}>
                <div style={{ width: 3, height: 40, background: 'var(--accent)', borderRadius: 2 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>{tk.showName}</div>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.04em', marginTop: 3 }}>{tk.date}</div>
                </div>
                {[['SEAT', tk.seat], ['PAID', `$${tk.price}`]].map(([l, v]) => (
                  <div key={l} style={{ minWidth: 80 }}>
                    <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.14em', marginBottom: 3 }}>{l}</div>
                    <div style={{ fontFamily: 'var(--f-d)', fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>{v}</div>
                  </div>
                ))}
                <div style={{ fontFamily: 'var(--f-m)', fontSize: 13, color: 'var(--ink-2)', letterSpacing: '.05em' }}>{tk.code}</div>
                <div style={{
                  padding: '4px 10px', border: `1px solid ${tk.status === 'CONFIRMED' ? 'rgba(34,229,212,.3)' : 'rgba(255,184,74,.3)'}`,
                  borderRadius: 99, fontFamily: 'var(--f-m)', fontSize: 12, letterSpacing: '.08em',
                  color: tk.status === 'CONFIRMED' ? '#22e5d4' : '#ffb84a',
                }}>{tk.status}</div>
                <button onClick={() => router.push(`/tickets/${tk.id}`)} style={{ color: 'var(--ink-3)', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer' }}><IcArrow s={12} /></button>
              </div>
            ))}
            {data.tickets.length === 0 && (
              <div style={{ padding: 24, fontFamily: 'var(--f-m)', fontSize: 13, color: 'var(--ink-3)', textAlign: 'center' }}>No tickets yet — browse events above.</div>
            )}
          </div>
        </div>
      )}

      {tab === 'selling' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
            {[
              { l: 'TICKETS SOLD', v: data.shows.reduce((a,s) => a + s.sold, 0).toString(), d: 'across all shows', c: '#22e5d4' },
              { l: 'GROSS', v: `$${data.shows.reduce((a,s) => a + s.sold * s.price, 0).toFixed(0)}`, d: 'this period', c: '#22e5d4' },
              { l: 'YOUR SHARE · 45%', v: `$${(data.shows.reduce((a,s) => a + s.sold * s.price, 0) * 0.45).toFixed(0)}`, d: '+ $0 platform fee', c: '#ff5029' },
              { l: 'PAYOUT PENDING', v: `$${(data.shows.reduce((a,s) => a + s.sold * s.price, 0) * 0.45).toFixed(0)}`, d: 'next release', c: '#ffb84a' },
            ].map(s => <StatCard key={s.l} label={s.l} value={s.v} delta={s.d} color={s.c} />)}
          </div>
          <div style={{ border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg-2)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>Shows on sale</div>
              <button style={{ padding: '9px 16px', background: 'var(--ink)', color: 'var(--bg)', borderRadius: 6, fontFamily: 'var(--f-m)', fontSize: 12, fontWeight: 600, letterSpacing: '.04em', border: 'none', cursor: 'pointer' }}>＋ New show</button>
            </div>
            {data.shows.map(s => {
              const pct = s.capacity > 0 ? (s.sold / s.capacity) * 100 : 0;
              return (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '14px 18px', borderBottom: '1px solid var(--line)' }}>
                  <div style={{ width: 3, height: 40, background: '#22e5d4', borderRadius: 2 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>{s.name} <span style={{ color: 'var(--ink-3)' }}>· {s.venue}</span></div>
                    <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.04em', marginTop: 3 }}>{s.date} · {s.time}</div>
                  </div>
                  <div style={{ minWidth: 90 }}>
                    <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.14em', marginBottom: 4 }}>SOLD</div>
                    <div style={{ width: 80, height: 4, background: 'rgba(255,255,255,.06)', borderRadius: 2, position: 'relative', overflow: 'hidden', marginBottom: 4 }}>
                      <div style={{ position: 'absolute', inset: 0, width: `${pct}%`, background: pct > 85 ? '#ffb84a' : '#22e5d4', borderRadius: 2 }} />
                    </div>
                    <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-2)' }}>{s.sold} / {s.capacity}</div>
                  </div>
                  <div style={{ minWidth: 60 }}><div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.14em', marginBottom: 3 }}>PRICE</div><div style={{ fontFamily: 'var(--f-d)', fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>${s.price}</div></div>
                  <div style={{ minWidth: 80 }}><div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.14em', marginBottom: 3 }}>GROSS</div><div style={{ fontFamily: 'var(--f-d)', fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>${(s.sold * s.price).toLocaleString()}</div></div>
                  <button style={{ padding: '7px 12px', border: '1px solid var(--line-2)', borderRadius: 5, fontFamily: 'var(--f-m)', fontSize: 13, color: 'var(--ink-2)', background: 'none', cursor: 'pointer' }}>Manage →</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'scan' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 18, padding: 24, border: '1px solid var(--line)', borderRadius: 12, background: 'var(--bg-2)' }}>
          <div>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, letterSpacing: '.18em', color: '#22e5d4', marginBottom: 10 }}>● VENUE MODE · GATE 1</div>
            <h2 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 30, letterSpacing: '-.025em', margin: '8px 0', color: 'var(--ink)' }}>Door scanner</h2>
            <p style={{ fontFamily: 'var(--f-b)', fontSize: 14, color: 'var(--ink-2)', maxWidth: 480, lineHeight: 1.5 }}>Point a phone camera at the QR. Valid tickets show green; replays are blocked at the protocol layer.</p>
            <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { code: 'iH-XX-K3X9', meta: 'GA · admitted 21:04', status: 'VALID', ok: true },
                { code: 'iH-XX-7QQR', meta: 'Transferred 14m ago · GA · admitted 21:06', status: 'VALID', ok: true },
                { code: 'iH-XX-9BLN', meta: 'Already scanned at 20:51 · blocked', status: 'REPLAY', ok: false },
              ].map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--bg-3)', borderRadius: 6, borderLeft: `2px solid ${r.ok ? '#22e5d4' : '#ff5029'}` }}>
                  {r.ok ? <IcCheck s={14} /> : <span style={{ fontSize: 14 }}>⨯</span>}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink)', letterSpacing: '.04em' }}>{r.code}</div>
                    <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{r.meta}</div>
                  </div>
                  <div style={{ color: r.ok ? '#22e5d4' : '#ff5029', fontFamily: 'var(--f-m)', fontSize: 11 }}>{r.status}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ aspectRatio: '1', background: 'var(--bg)', border: '1px solid var(--line-2)', borderRadius: 10, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ position: 'absolute', inset: 30, border: '2px solid rgba(34,229,212,.5)', borderRadius: 4 }} />
              <div style={{ position: 'absolute', left: 30, right: 30, top: '50%', height: 1, background: '#22e5d4', boxShadow: '0 0 16px #22e5d4' }} />
              <div style={{ position: 'absolute', left: 0, right: 0, bottom: 18, textAlign: 'center', fontFamily: 'var(--f-m)', fontSize: 13, color: 'var(--ink-3)', letterSpacing: '.1em' }}>Ready for QR…</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, padding: '14px 16px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg-3)' }}>
              {[['ADMITTED', '148', 'var(--ink)'], ['WAITING', '23', 'var(--ink)'], ['BLOCKED', '2', '#ff5029']].map(([l, v, c]) => (
                <div key={l}>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '.14em', marginBottom: 3 }}>{l}</div>
                  <div style={{ fontFamily: 'var(--f-d)', fontWeight: 600, fontSize: 13, color: c }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>

    {/* Report modal */}
    {reportingId && (
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        onClick={(e) => { if (e.target === e.currentTarget) setReportingId(null); }}
      >
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 16, padding: '24px 24px 20px', width: '100%', maxWidth: 400 }}>
          <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 18, color: 'var(--ink)', marginBottom: 6 }}>Report this show</div>
          <p style={{ fontFamily: 'var(--f-b)', fontSize: 13, color: 'var(--ink-2)', margin: '0 0 14px', lineHeight: 1.5 }}>Tell us what&apos;s wrong — spam, misleading info, or anything suspicious.</p>
          {reportStatus === 'done' ? (
            <div style={{ textAlign: 'center', padding: '20px 0', fontFamily: 'var(--f-m)', fontSize: 14, color: '#22e5d4' }}>✓ Report submitted — thank you.</div>
          ) : (
            <>
              <textarea
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="Describe the issue…"
                rows={3}
                style={{ width: '100%', background: 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: 8, color: 'var(--ink)', fontFamily: 'var(--f-b)', fontSize: 13, padding: '10px 12px', resize: 'none', boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button onClick={() => setReportingId(null)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid var(--line-2)', background: 'none', color: 'var(--ink-2)', fontFamily: 'var(--f-m)', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                <button
                  onClick={() => void submitReport(reportingId)}
                  disabled={!reportReason.trim() || reportStatus === 'sending'}
                  style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #ff5029, #ff3e9a)', color: '#fff', fontFamily: 'var(--f-m)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                >
                  {reportStatus === 'sending' ? 'Submitting…' : 'Submit report'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    )}
    </>
  );
});

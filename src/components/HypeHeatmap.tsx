'use client';

import React from 'react';

// ─────────────────────────────────────────────────────────────────
// HYPE Heatmap — artist-side tour planner.
//
// A flat US-focused heatmap with HYPE concentration dots, plus side
// panels for ranked cities and venue radar pings. Designed to live
// alongside the live `ActivityMap` (which is globe-based) as a
// complementary tour-planning lens for the artist Studio view.
//
// Pure presentation — pass in your data. To wire data-driven dots
// from real lat/lng, use the same projection helpers as ActivityMap:
//   x = (longitude + 180) / 360
//   y = (90 - latitude)  / 180
// then clip / pan to the bounding box you want.
// ─────────────────────────────────────────────────────────────────

export type HypeHeatmapCity = {
  /** Display name, e.g. "Chicago". */
  name: string;
  /** 0..1 within the map viewport (0 = left/top edge). */
  x: number;
  y: number;
  /** Total HYPE concentration in this city. */
  hype: number;
  /** Count of venues asking to book the artist in this city. */
  venuesAsking: number;
  /** Mark this city as a hotspot — gets a glow + label badge. */
  hot?: boolean;
};

export type HypeHeatmapVenuePing = {
  id: string;
  name: string;
  city: string;
  capacity: number;
  /** Human-readable status, e.g. "wants Aug 8–10" or "CONFIRMED Jun 18". */
  statusLabel: string;
  /**
   * 'confirmed' | 'urgent' | 'interest' — drives the dot/text color.
   * confirmed = aqua, urgent = pink, interest = ember.
   */
  signal: 'confirmed' | 'urgent' | 'interest';
  onReply?: () => void;
};

export type HypeHeatmapProps = {
  cities: HypeHeatmapCity[];
  venuePings: HypeHeatmapVenuePing[];
  /** Optional suggested tour route ("CHI → BKN → ATX"). */
  suggestedRoute?: string;
};

const SIGNAL_COLORS = {
  confirmed: '#22e5d4',
  urgent: '#ff3e9a',
  interest: '#ff5029',
} as const;

export function HypeHeatmap({ cities, venuePings, suggestedRoute }: HypeHeatmapProps) {
  const maxHype = Math.max(1, ...cities.map((c) => c.hype));
  const ranked = [...cities].sort((a, b) => b.hype - a.hype);
  const totalHype = cities.reduce((s, c) => s + c.hype, 0);
  const totalVenues = cities.reduce((s, c) => s + c.venuesAsking, 0);
  const hotCount = cities.filter((c) => c.hot).length;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 14 }}>
      <section style={panel}>
        <PanelHeader title={<>Where you&apos;re HYPEd <span style={panelCount}>· last 30 days</span></>} help="Bigger dot = more HYPE · ring = venue asking" />

        <div style={mapBox}>
          <div style={mapBg} />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={`h${i}`} style={{ ...mapGrid, top: `${((i + 1) * 100) / 7}%`, left: 0, right: 0, height: 1 }} />
          ))}
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={`v${i}`} style={{ ...mapGrid, left: `${((i + 1) * 100) / 8}%`, top: 0, bottom: 0, width: 1 }} />
          ))}

          {cities.map((c) => {
            const intensity = c.hype / maxHype;
            const size = 10 + intensity * 34;
            const color = c.hot ? '#ff3e9a' : intensity > 0.4 ? '#ff5029' : '#b983ff';
            return (
              <div
                key={c.name}
                style={{ position: 'absolute', left: `${c.x * 100}%`, top: `${c.y * 100}%`, transform: 'translate(-50%,-50%)' }}
              >
                <div style={{ width: size, height: size, borderRadius: '50%', background: `radial-gradient(circle, ${color} 0%, ${color}30 70%, transparent 100%)`, position: 'relative' }}>
                  <div style={{ position: 'absolute', inset: size * 0.28, borderRadius: '50%', background: color, boxShadow: c.hot ? `0 0 12px ${color}` : 'none' }} />
                  {c.venuesAsking > 0 && (
                    <div style={{ position: 'absolute', inset: -4, border: `1.5px dashed ${color}80`, borderRadius: '50%' }} />
                  )}
                </div>
                <div
                  style={{
                    position: 'absolute', left: '50%', transform: 'translateX(-50%)', marginTop: 6,
                    fontFamily: 'var(--f-m)', fontSize: 9, letterSpacing: '.08em', whiteSpace: 'nowrap', textTransform: 'uppercase',
                    color: intensity > 0.5 ? 'var(--ink)' : 'var(--ink-2)',
                  }}
                >
                  {c.name}
                </div>
                {c.hot && (
                  <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', marginTop: 22, padding: '1px 6px', background: '#ff3e9a', color: '#0a0805', fontFamily: 'var(--f-m)', fontSize: 8, fontWeight: 700, borderRadius: 3, letterSpacing: '.08em', whiteSpace: 'nowrap' }}>
                    {c.hype}
                  </div>
                )}
              </div>
            );
          })}

          <Legend />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginTop: 12, padding: '12px 14px', background: 'var(--bg-3)', borderRadius: 8 }}>
          <Stat label="TOTAL HYPE" value={totalHype.toLocaleString()} />
          <Stat label="HOT CITIES" value={hotCount} valueColor="#ff3e9a" />
          <Stat label="VENUES ASKING" value={totalVenues} valueColor="#22e5d4" />
          <Stat label="SUGGESTED ROUTE" value={suggestedRoute ?? '—'} small />
        </div>
      </section>

      <section style={panel}>
        <PanelHeader title="Top cities" help="By HYPE" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ranked.slice(0, 8).map((c, i) => {
            const pct = (c.hype / maxHype) * 100;
            const color = c.hot ? '#ff3e9a' : '#ff5029';
            return (
              <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '.08em', width: 22 }}>
                  {String(i + 1).padStart(2, '0')}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--f-d)', fontWeight: 600, fontSize: 13, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    {c.name}
                    {c.hot && (
                      <span style={{ padding: '1px 6px', background: '#ff3e9a', color: '#0a0805', fontFamily: 'var(--f-m)', fontSize: 8, fontWeight: 700, borderRadius: 3, letterSpacing: '.1em' }}>
                        HOT
                      </span>
                    )}
                  </div>
                  <div style={{ marginTop: 4, height: 3, background: 'rgba(255,255,255,.05)', borderRadius: 2, position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', inset: 0, width: `${pct}%`, background: color, borderRadius: 2 }} />
                  </div>
                </div>
                <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 13, color: 'var(--ink-2)', minWidth: 44, textAlign: 'right' }}>
                  {c.hype}
                </div>
              </div>
            );
          })}
        </div>

        <PanelHeader
          title={<>Venues asking <span style={panelCount}>· demand radar pings</span></>}
          style={{ marginTop: 18 }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {venuePings.map((v) => {
            const color = SIGNAL_COLORS[v.signal];
            return (
              <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg-3)', borderRadius: 6 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: color }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--f-d)', fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>{v.name}</div>
                  <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-3)', marginTop: 2, letterSpacing: '.04em' }}>
                    {v.city} · cap {v.capacity} · <span style={{ color }}>{v.statusLabel}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={v.onReply}
                  style={{ padding: '5px 10px', border: '1px solid var(--line-2)', borderRadius: 5, fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-2)', letterSpacing: '.08em', background: 'transparent', cursor: 'pointer' }}
                >
                  Reply →
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────

function PanelHeader({ title, help, style }: { title: React.ReactNode; help?: string; style?: React.CSSProperties }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14, gap: 12, ...style }}>
      <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 14, letterSpacing: '-.005em', color: 'var(--ink)' }}>
        {title}
      </div>
      {help && (
        <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '.04em' }}>
          {help}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, valueColor, small }: { label: string; value: React.ReactNode; valueColor?: string; small?: boolean }) {
  return (
    <div>
      <div style={{ fontFamily: 'var(--f-m)', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '.14em', marginBottom: 3 }}>{label}</div>
      <div style={{ fontFamily: 'var(--f-d)', fontWeight: 600, fontSize: small ? 14 : 18, color: valueColor ?? 'var(--ink)' }}>{value}</div>
    </div>
  );
}

function Legend() {
  return (
    <div style={{
      position: 'absolute', left: 14, bottom: 14, padding: '10px 12px',
      background: 'rgba(10,8,5,.7)', backdropFilter: 'blur(8px)', border: '1px solid var(--line)',
      borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 5,
    }}>
      {[
        { c: '#ff3e9a', label: 'HOTSPOT · plan a date', glow: true },
        { c: '#ff5029', label: 'HYPE rising' },
        { c: '#b983ff', label: 'Seeded · not yet hot' },
        { c: 'transparent', label: 'Venue radar ping', ring: true },
      ].map((row) => (
        <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--f-m)', fontSize: 9, color: 'var(--ink-2)', letterSpacing: '.08em' }}>
          <span style={{
            width: 9, height: 9, borderRadius: '50%',
            background: row.c,
            boxShadow: row.glow ? `0 0 8px ${row.c}` : 'none',
            border: row.ring ? '1.5px dashed #ff3e9a' : 'none',
          }} />
          {row.label}
        </div>
      ))}
    </div>
  );
}

const panel: React.CSSProperties = { border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg-2)', padding: '16px 18px' };
const panelCount: React.CSSProperties = { fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '.04em', fontWeight: 400 };
const mapBox: React.CSSProperties = { position: 'relative', height: 380, borderRadius: 10, background: 'var(--bg-3)', overflow: 'hidden', border: '1px solid var(--line)' };
const mapBg: React.CSSProperties = { position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 40% 45%, rgba(255,80,41,.04) 0%, transparent 60%), radial-gradient(ellipse at 80% 40%, rgba(255,62,154,.05) 0%, transparent 50%)' };
const mapGrid: React.CSSProperties = { position: 'absolute', background: 'rgba(255,255,255,.025)' };

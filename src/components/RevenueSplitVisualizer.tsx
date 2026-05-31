'use client';

import React from 'react';

// ─────────────────────────────────────────────────────────────────
// Revenue Split Visualizer — the 45/45/10 breakdown.
//
// 45% artists  (split evenly across the tracks in the show)
// 45% host     (the show creator, this account)
// 10% referrer (either a named co-host or the open referral pool)
//
// Drop into a show-creation flow next to the publish step. Pure
// presentation; controlled inputs raise change events upward.
// ─────────────────────────────────────────────────────────────────

export type RevenueSplitTrack = {
  id: string;
  artistName: string;
  trackTitle: string;
  /** Hex color used as the dot accent for the row. */
  color: string;
};

export type RevenueSplitProjection = {
  /** Total dollars projected over the projection window (first 30d typical). */
  totalDollars: number;
  /** Window label for context, e.g. "based on your last 4 shows". */
  windowLabel: string;
  /** Projected listen count. */
  listens: number;
};

export type RevenueSplitVisualizerProps = {
  tracks: RevenueSplitTrack[];
  hostName: string;
  /** Free-text co-host or referrer label. If `mode === 'referrer'`, label reads "Anyone who shares your show". */
  referrerLabel: string;
  /** Controls which side the 10% goes to. */
  mode: 'co-host' | 'referrer';
  onModeChange?: (mode: 'co-host' | 'referrer') => void;
  onReferrerLabelChange?: (value: string) => void;
  projection?: RevenueSplitProjection | null;
  /** Optional click handler for a scheduling/publish CTA on the projection card. */
  onSchedule?: () => void;
};

export function RevenueSplitVisualizer({
  tracks,
  hostName,
  referrerLabel,
  mode,
  onModeChange,
  onReferrerLabelChange,
  projection,
  onSchedule,
}: RevenueSplitVisualizerProps) {
  const perArtistPct = tracks.length > 0 ? 45 / tracks.length : 0;

  return (
    <section style={panel}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14, gap: 12 }}>
        <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 14, letterSpacing: '-.005em', color: 'var(--ink)' }}>
          Revenue split
        </div>
        <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '.04em' }}>
          Auto-applied at every play / pre-roll / paid listen · iHYPE takes 0%
        </div>
      </header>

      {/* Split bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 18, height: 64, borderRadius: 8, overflow: 'hidden' }}>
        <SplitBar pct={45} color="#ff5029" who={`ARTISTS (${tracks.length || 0})`} />
        <SplitBar pct={45} color="#b983ff" who="YOU · HOST" />
        <SplitBar pct={10} color="#ff3e9a" who={mode === 'co-host' ? 'CO-HOST' : 'REFERRERS'} />
      </div>

      {/* Detail */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Label>ARTISTS (45%)</Label>
          {tracks.length === 0 && (
            <div style={{ padding: '10px 12px', background: 'var(--bg-3)', borderRadius: 6, fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '.04em' }}>
              No tracks selected yet.
            </div>
          )}
          {tracks.map((t) => (
            <Row key={t.id}>
              <Dot color={t.color} />
              <div style={{ flex: 1 }}>
                <Name>{t.artistName}</Name>
                <Sub>{t.trackTitle}</Sub>
              </div>
              <Pct>{perArtistPct.toFixed(1)}%</Pct>
            </Row>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Label>YOU · HOST (45%)</Label>
          <Row>
            <Dot color="#b983ff" />
            <div style={{ flex: 1 }}>
              <Name>{hostName}</Name>
              <Sub>Show host · this account</Sub>
            </div>
            <Pct>45%</Pct>
          </Row>

          <Label>{mode === 'co-host' ? 'CO-HOST (10%)' : 'REFERRERS (10%)'}</Label>
          <Row>
            <input
              type="text"
              value={referrerLabel}
              onChange={(e) => onReferrerLabelChange?.(e.target.value)}
              placeholder={mode === 'co-host' ? 'Named co-host…' : 'Anyone who shares your show'}
              style={{ flex: 1, background: 'transparent', border: 0, outline: 0, color: 'var(--ink)', fontFamily: 'var(--f-b)', fontSize: 13 }}
            />
            <button
              type="button"
              onClick={() => onModeChange?.(mode === 'co-host' ? 'referrer' : 'co-host')}
              style={{ fontFamily: 'var(--f-m)', fontSize: 9, color: 'var(--ink-2)', letterSpacing: '.08em', textTransform: 'uppercase', padding: '4px 8px', border: '1px solid var(--line-2)', borderRadius: 99, background: 'transparent', cursor: 'pointer' }}
            >
              {mode === 'co-host' ? 'Use referrers instead' : 'Add named co-host'}
            </button>
            <Pct>10%</Pct>
          </Row>
        </div>
      </div>

      {/* Projection card */}
      {projection && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: 'var(--bg-3)', borderRadius: 8, gap: 14 }}>
          <div>
            <div style={{ fontFamily: 'var(--f-m)', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '.16em', marginBottom: 8 }}>
              PROJECTED · {projection.windowLabel.toUpperCase()}
            </div>
            <div style={{ display: 'flex', gap: 32 }}>
              <ProjStat value={`$${projection.totalDollars.toLocaleString()}`} sub="total · first 30 days" />
              <ProjStat value={`$${Math.round(projection.totalDollars * 0.45).toLocaleString()}`} sub="your cut" />
              <ProjStat value={`~${projection.listens.toLocaleString()}`} sub="listens" color="#22e5d4" />
            </div>
          </div>
          {onSchedule && (
            <button
              type="button"
              onClick={onSchedule}
              style={{ padding: '12px 20px', background: 'var(--accent)', color: 'var(--bg)', borderRadius: 6, fontFamily: 'var(--f-m)', fontSize: 12, fontWeight: 600, letterSpacing: '.06em', display: 'flex', alignItems: 'center', gap: 6, border: 'none', cursor: 'pointer' }}
            >
              ⚡ Schedule show
            </button>
          )}
        </div>
      )}
    </section>
  );
}

// ── tiny styled bits ─────────────────────────────────────────────

function SplitBar({ pct, color, who }: { pct: number; color: string; who: string }) {
  return (
    <div style={{ width: `${pct}%`, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 14px', color: '#0a0805', background: color, position: 'relative' }}>
      <span style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 22, letterSpacing: '-.02em' }}>{pct}%</span>
      <span style={{ fontFamily: 'var(--f-m)', fontSize: 9, letterSpacing: '.14em', marginTop: 2, opacity: 0.85 }}>{who}</span>
    </div>
  );
}

const Label = ({ children }: { children: React.ReactNode }) => (
  <div style={{ fontFamily: 'var(--f-m)', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '.16em', marginTop: 4 }}>{children}</div>
);
const Row = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'var(--bg-3)', borderRadius: 6 }}>{children}</div>
);
const Dot = ({ color }: { color: string }) => (
  <div style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: color }} />
);
const Name = ({ children }: { children: React.ReactNode }) => (
  <div style={{ fontFamily: 'var(--f-d)', fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>{children}</div>
);
const Sub = ({ children }: { children: React.ReactNode }) => (
  <div style={{ fontFamily: 'var(--f-m)', fontSize: 10, color: 'var(--ink-3)', marginTop: 2 }}>{children}</div>
);
const Pct = ({ children }: { children: React.ReactNode }) => (
  <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>{children}</div>
);

function ProjStat({ value, sub, color }: { value: string; sub: string; color?: string }) {
  return (
    <div>
      <div style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 22, letterSpacing: '-.02em', color: color ?? 'var(--ink)' }}>{value}</div>
      <div style={{ fontFamily: 'var(--f-m)', fontSize: 9, color: 'var(--ink-3)', letterSpacing: '.06em', marginTop: 3 }}>{sub}</div>
    </div>
  );
}

const panel: React.CSSProperties = { border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg-2)', padding: '16px 18px' };

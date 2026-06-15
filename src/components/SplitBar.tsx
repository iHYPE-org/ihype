'use client';

import React from 'react';

interface SplitSegment { key: 'artist' | 'venue' | 'promoter'; pct: number; }

const SEG: Record<string, { color: string; label: string }> = {
  artist:   { color: 'var(--role-artist)',   label: 'Artist' },
  venue:    { color: 'var(--role-venue)',    label: 'Venue' },
  promoter: { color: 'var(--role-promoter)', label: 'Promoter' },
};

const DEFAULT_SPLIT: SplitSegment[] = [
  { key: 'artist', pct: 45 },
  { key: 'venue', pct: 45 },
  { key: 'promoter', pct: 10 },
];

interface SplitBarProps {
  /** Ticket price — shows dollar amounts when provided, plain % when omitted. */
  total?: number;
  /** Custom split. Defaults to 45/45/10. */
  parts?: SplitSegment[];
  /** Bar height in px. @default 10 */
  height?: number;
  /** Show the legend below the bar. @default true */
  showLegend?: boolean;
  /** Compact mode: smaller legend text. @default false */
  compact?: boolean;
  style?: React.CSSProperties;
}

export function SplitBar({ total, parts, height = 10, showLegend = true, compact = false, style }: SplitBarProps) {
  const split = parts || DEFAULT_SPLIT;
  const money = (pct: number) => total != null ? `$${((total * pct) / 100).toFixed(2)}` : `${pct}%`;

  return (
    <div style={style}>
      <div style={{ display: 'flex', width: '100%', height, borderRadius: 999, overflow: 'hidden', gap: 2, background: 'var(--bg-2)' }}>
        {split.map((s) => (
          <div
            key={s.key}
            title={`${SEG[s.key].label} ${s.pct}%`}
            style={{ width: `${s.pct}%`, background: SEG[s.key].color, opacity: 0.92 }}
          />
        ))}
      </div>
      {showLegend && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: compact ? '0.5rem 1rem' : '0.5rem 1.25rem', marginTop: 8 }}>
          {split.map((s) => (
            <span key={s.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--f-m)', fontSize: compact ? 11 : 12, color: 'var(--ink-2)' }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: SEG[s.key].color, display: 'inline-block' }} />
              {SEG[s.key].label}
              <b style={{ color: 'var(--ink)', fontWeight: 700 }}>{money(s.pct)}</b>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

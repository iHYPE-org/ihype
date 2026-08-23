import React from 'react';

/* Re-anchored to design tokens, 2026-08-22. Prop signature UNCHANGED so
   _adherence.oxlintrc.json stays valid — this is strictly internal.
   · label 9 and value 9 → var(--text-xs) (11px mono floor)
   · the % readout coloured itself with the raw accent → ink-mixed. It is the
     only number in the component, so it was the one thing guaranteed to be read.
   · borderRadius 99 → var(--radius-pill); track rgba → var(--hair-70)
   · transition 400ms + inline bezier → var(--duration-slow) / var(--ease) */

const inkSafe = (c) => `color-mix(in oklab, ${c} 62%, var(--ink-1))`;

export function ProgressBar({ value = 0, max = 100, accent = 'var(--accent)', height = 5, label, showValue, style: s }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', ...s }}>
      {(label || showValue) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 'var(--space-3)' }}>
          {label && (
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-xs)',
              letterSpacing: 'var(--tracking-wide)',
              textTransform: 'uppercase',
              color: 'var(--ink-3)',
            }}>{label}</div>
          )}
          {showValue && (
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-xs)',
              color: inkSafe(accent),
            }}>{`${Math.round(pct)}%`}</div>
          )}
        </div>
      )}
      <div style={{ height, borderRadius: 'var(--radius-pill)', background: 'var(--hair-70)', overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: accent,
          borderRadius: 'var(--radius-pill)',
          transition: 'width var(--duration-slow) var(--ease)',
        }} />
      </div>
    </div>
  );
}

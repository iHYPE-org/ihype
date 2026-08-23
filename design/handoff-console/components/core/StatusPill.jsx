import React from 'react';

/* Re-anchored to design tokens, 2026-08-22. Prop signature UNCHANGED so
   _adherence.oxlintrc.json stays valid — this is strictly internal.
   BUG FIXED: 'ok' was #22e5d4 (pre-console cyan) and 'warn' coloured its
   text with the raw accent. Both replaced with semantic tokens whose *-text pair
   passes on cream.
   
   · fontSize 10 → var(--text-xs); height 22 → 24 to fit it
   · borderRadius 999 and dot '50%' → var(--radius-pill)
   · rgba fills → color-mix on the token */

const TONES = {
  ok:      { fill: 'var(--success)',      ink: 'var(--success)' },
  pending: { fill: 'var(--warning)',      ink: 'var(--warning-text)' },
  warn:    { fill: 'var(--color-error)',  ink: 'var(--color-error)' },
  neutral: { fill: 'var(--ink-3)',        ink: 'var(--ink-2)' },
};

export function StatusPill({ children, tone = 'neutral', dot }) {
  const t = TONES[tone] || TONES.neutral;
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 'var(--space-1)',
      height: 24,
      padding: '0 var(--space-3)',
      borderRadius: 'var(--radius-pill)',
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--text-xs)',
      fontWeight: 600,
      letterSpacing: 'var(--tracking-wide)',
      textTransform: 'uppercase',
      background: `color-mix(in oklab, ${t.fill} 15%, transparent)`,
      color: t.ink,
    }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: 'var(--radius-pill)', background: t.fill, flexShrink: 0 }} />}
      {children}
    </span>
  );
}

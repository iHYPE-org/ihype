import React from 'react';

/* Re-anchored to design tokens, 2026-08-22. Prop signature UNCHANGED so
   _adherence.oxlintrc.json stays valid — this is strictly internal.
   · fontSize 9 → var(--text-xs) (11px mono floor)
   · #6b5a3e → var(--ink-3)
   · letterSpacing .18em → var(--tracking-wider) (.14em, the nearest token) */

export function Eyebrow({ children, color = 'var(--ink-3)' }) {
  return (
    <div style={{
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--text-xs)',
      fontWeight: 600,
      letterSpacing: 'var(--tracking-wider)',
      textTransform: 'uppercase',
      color,
    }}>{children}</div>
  );
}

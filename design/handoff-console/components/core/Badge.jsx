import React from 'react';

/* Re-anchored to design tokens, 2026-08-22. Prop signature UNCHANGED so
   _adherence.oxlintrc.json stays valid — this is strictly internal.
   · fontSize 9 → var(--text-xs) (11px mono floor); height 20 → 22 to fit it
   · borderRadius 4 → var(--radius-sm) (same value, now a token)
   · filled variant coloured its TEXT with the raw accent — 2.48:1, fails AA.
     Now ink-mixed. Outline keeps the accent on the border, where a fill is legal.
   · letterSpacing .14em → var(--tracking-wider) */

/* An accent passed in may be any role colour, so a fixed var(--accent-text)
   would break Fan violet / Venue teal / Advertiser amber. Mixing 62% toward
   ink lands in the same contrast band for every hue. */
const inkSafe = (c) => `color-mix(in oklab, ${c} 62%, var(--ink-1))`;

export function Badge({ children, color = 'var(--accent)', variant = 'filled' }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      height: 22,
      padding: '0 var(--space-2)',
      borderRadius: 'var(--radius-sm)',
      fontFamily: 'var(--font-mono)',
      fontSize: 'var(--text-xs)',
      fontWeight: 600,
      letterSpacing: 'var(--tracking-wider)',
      textTransform: 'uppercase',
      background: variant === 'filled' ? `color-mix(in oklab, ${color} 13%, transparent)` : 'transparent',
      color: inkSafe(color),
      border: variant === 'outline' ? `1px solid color-mix(in oklab, ${color} 50%, transparent)` : 'none',
    }}>{children}</span>
  );
}

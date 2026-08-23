'use client';
import React from 'react';

/* Re-anchored to design tokens, 2026-08-22. Prop signature UNCHANGED so
   _adherence.oxlintrc.json stays valid — this is strictly internal.
   · fontSize 9 → var(--text-xs) (11px mono floor); height 28 → 32 to fit
   · active state coloured its TEXT with the raw accent — fails AA. Now ink-mixed.
   · rgba literals → var(--hair-70) / var(--line)
   · transition 'all 150ms' → tokens
   
   NOTE: 32px is still under the 44px touch-target floor. Chips sit in scrolling
   filter rows where 44 breaks the layout, so the target is expanded by the row's
   padding rather than the chip's height — verify that on any new surface. */

/* An accent passed in may be any role colour, so a fixed var(--accent-text)
   would break Fan violet / Venue teal / Advertiser amber. Mixing 62% toward
   ink lands in the same contrast band for every hue. */
const inkSafe = (c) => `color-mix(in oklab, ${c} 62%, var(--ink-1))`;

export function Chip({ children, accent = 'var(--accent)', active = false, leading, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-1)',
        height: 32,
        padding: '0 var(--space-3)',
        borderRadius: 'var(--radius-pill)',
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--text-xs)',
        fontWeight: 600,
        letterSpacing: 'var(--tracking-wider)',
        textTransform: 'uppercase',
        background: active ? `color-mix(in oklab, ${accent} 13%, transparent)` : 'var(--hair-70)',
        color: active ? inkSafe(accent) : 'var(--ink-2)',
        border: `1px solid ${active ? `color-mix(in oklab, ${accent} 44%, transparent)` : 'var(--line)'}`,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background var(--duration-default) var(--ease), color var(--duration-default) var(--ease), border-color var(--duration-default) var(--ease)',
        whiteSpace: 'nowrap',
      }}
    >{leading}{children}</button>
  );
}

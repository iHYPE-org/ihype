'use client';
import React from 'react';

/* Re-anchored to design tokens, 2026-08-22. Original read 0 tokens.
   Prop signature is UNCHANGED so _adherence.oxlintrc.json stays valid.
   Next.js app-router ready: explicit React import, 'use client' where the
   component takes a handler. */
/* Fixed here:
   · borderRadius 14 → var(--radius-md) (8px, the button/input step)
   · fontSize 14 → var(--text-base) (15px content floor)
   · #ff5029 / #1c1408 → var(--accent) / var(--ink-on-accent)
   · ghost + outline used the accent AS TEXT (2.48:1, fails AA). They now
     derive an AA-safe tone by mixing the accent toward ink — this works for
     any accent passed in, including role colours, which a fixed
     var(--accent-text) would not.
   · height 44 kept: it is the touch-target floor, not a style choice. */

const inkSafe = (accent) => `color-mix(in oklab, ${accent} 62%, var(--ink-1))`;

export function Button({
  children,
  tone = 'solid',
  accent = 'var(--accent)',
  disabled = false,
  leading,
  full,
  onClick,
}) {
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--space-2)',
    height: 44,
    padding: '0 var(--space-5)',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    fontFamily: 'var(--font-body)',
    fontSize: 'var(--text-base)',
    fontWeight: 600,
    letterSpacing: 'var(--tracking-normal)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.45 : 1,
    width: full ? '100%' : undefined,
    transition: 'opacity var(--duration-fast) var(--ease), background var(--duration-fast) var(--ease)',
  };

  const tones = {
    solid: { ...base, background: accent, color: 'var(--ink-on-accent)' },
    ghost: {
      ...base,
      background: `color-mix(in oklab, ${accent} 13%, transparent)`,
      color: inkSafe(accent),
    },
    outline: {
      ...base,
      background: 'transparent',
      color: inkSafe(accent),
      border: `1px solid color-mix(in oklab, ${accent} 40%, transparent)`,
    },
  };

  return (
    <button style={tones[tone] || tones.solid} disabled={disabled} onClick={onClick}>
      {leading}
      {children}
    </button>
  );
}

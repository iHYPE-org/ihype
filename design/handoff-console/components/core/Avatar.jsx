import React from 'react';

/* Re-anchored to design tokens, 2026-08-22. Prop signature UNCHANGED so
   _adherence.oxlintrc.json stays valid — this is strictly internal.
   · #ff5029 / #1c1408 → var(--accent) / var(--ink-on-accent)
   · borderRadius '50%' → var(--radius-pill)
   · fontSize was size*0.38 unclamped — at size 24 that is 9px, below the 11px
     mono floor. Now clamped so a small avatar cannot drop under it. */

export function Avatar({ name = '', roleColor = 'var(--accent)', size = 32 }) {
  const initials = name.split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: 'var(--radius-pill)',
      background: roleColor,
      color: 'var(--ink-on-accent)',
      /* Initials are a label at 38% of a small circle, not display text: mono at
         700 holds at that size where a single-weight serif goes weak. */
      fontFamily: 'var(--font-mono)',
      fontWeight: 700,
      fontSize: Math.max(11, Math.round(size * 0.38)),
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}>{initials}</div>
  );
}

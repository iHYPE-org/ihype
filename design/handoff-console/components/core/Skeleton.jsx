import React from 'react';

/* Re-anchored to design tokens, 2026-08-22. Prop signature UNCHANGED so
   _adherence.oxlintrc.json stays valid — this is strictly internal.
   · #ddc998 → var(--bg-raised); rgba(28,20,8,.05) → var(--hair-50)
   · radius 6 → var(--radius-sm); line height 12 → var(--text-base) equivalent
   · animation duration → var(--duration-xslow) so reduced-motion disables it
     (motion.css zeroes the durations under prefers-reduced-motion; a hardcoded
     1.6s ignored that and kept shimmering) */

export function Skeleton({ width = '100%', height = 16, radius = 'var(--radius-sm)', style: s }) {
  return (
    <div style={{
      width,
      height,
      borderRadius: radius,
      background: 'linear-gradient(90deg, var(--bg-raised) 25%, var(--hair-50) 50%, var(--bg-raised) 75%)',
      backgroundSize: '200% 100%',
      animation: 'ihype-shimmer var(--duration-xslow) var(--ease-in-out) infinite',
      flexShrink: 0,
      ...s,
    }} />
  );
}

export function SkeletonText({ lines = 3, lastWidth = '60%', style: s }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', ...s }}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? lastWidth : '100%'} height={12} />
      ))}
    </div>
  );
}

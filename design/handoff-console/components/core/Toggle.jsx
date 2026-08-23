'use client';
import React from 'react';

/* Re-anchored to design tokens, 2026-08-22. Prop signature UNCHANGED so
   _adherence.oxlintrc.json stays valid — this is strictly internal.
   · #ff5029 / #1c1408 → var(--accent) / var(--ink-1)
   · track radius 13 and thumb '50%' → var(--radius-pill)
   · label 14 → var(--text-base); detail 11 → var(--text-base) (both are content)
   · hardcoded 180ms + inline cubic-bezier → var(--duration-*) / var(--ease)
   · the thumb's black drop shadow → var(--shadow-card); a raw
     rgba(0,0,0,.3) reads cold against warm cream */

export function Toggle({ on = false, label, detail, onChange }) {
  return (
    <div
      onClick={() => onChange && onChange(!on)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-4)',
        padding: 'var(--space-4)',
        borderBottom: '1px solid var(--hair-70)',
        fontFamily: 'var(--font-body)',
        cursor: 'pointer',
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 'var(--text-base)', fontWeight: 500, color: 'var(--ink-1)' }}>{label}</div>
        {detail && (
          <div style={{ fontSize: 'var(--text-base)', color: 'var(--ink-3)', marginTop: 'var(--space-1)' }}>{detail}</div>
        )}
      </div>
      <div style={{
        width: 44,
        height: 26,
        borderRadius: 'var(--radius-pill)',
        flexShrink: 0,
        background: on ? 'var(--accent)' : 'var(--line)',
        position: 'relative',
        transition: 'background var(--duration-default) var(--ease)',
      }}>
        <div style={{
          position: 'absolute',
          top: 3,
          left: on ? 21 : 3,
          width: 20,
          height: 20,
          borderRadius: 'var(--radius-pill)',
          background: 'var(--ink-1)',
          boxShadow: 'var(--shadow-card)',
          transition: 'left var(--duration-default) var(--ease)',
        }} />
      </div>
    </div>
  );
}

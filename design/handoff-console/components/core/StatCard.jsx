import React from 'react';

/* Re-anchored to design tokens, 2026-08-22. Original read 0 tokens.
   Prop signature is UNCHANGED so _adherence.oxlintrc.json stays valid.
   Next.js app-router ready: explicit React import, 'use client' where the
   component takes a handler. */
/* Fixed here — this component had every category of drift at once:
   · borderRadius 14 → var(--radius-panel) (3px)
   · backdropFilter blur(24px) removed → var(--bg-surface)
   · fontWeight 800 on Instrument Serif. That weight DOES NOT EXIST — the
     family ships 400 regular + 400 italic only, so 800 was synthesising a
     fake bold. Now 400.
   · letterSpacing -.02em removed. Instrument Serif is already tight; that
     negative tracking belongs to the retired Bricolage Grotesque.
   · value colour was the raw accent — 2.48:1 on cream, fails AA, and it was
     the largest text in the component. Now an ink-mixed safe tone.
   · label + delta fontSize 10 → var(--text-xs) (11px mono floor)
   · fontSize 24 was off-scale → var(--text-xl) (28px) */

const inkSafe = (accent) => `color-mix(in oklab, ${accent} 62%, var(--ink-1))`;

export function StatCard({ value, label, accent = 'var(--accent)', delta, style }) {
  const card = {
    border: '1px solid var(--line)',
    borderRadius: 'var(--radius-panel)',
    background: 'var(--bg-surface)',
    padding: 'var(--space-5) var(--space-4)',
    textAlign: 'center',
    ...style,
  };

  return (
    <div style={card}>
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: 'var(--text-xl)',
        fontWeight: 400,
        lineHeight: 'var(--leading-heading)',
        letterSpacing: 'var(--tracking-normal)',
        color: inkSafe(accent),
      }}>{value}</div>
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--text-xs)',
        letterSpacing: 'var(--tracking-wider)',
        textTransform: 'uppercase',
        color: 'var(--ink-2)',
        marginTop: 'var(--space-2)',
      }}>{label}</div>
      {delta && (
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-xs)',
          letterSpacing: 'var(--tracking-wide)',
          color: inkSafe(accent),
          marginTop: 'var(--space-1)',
        }}>{delta}</div>
      )}
    </div>
  );
}

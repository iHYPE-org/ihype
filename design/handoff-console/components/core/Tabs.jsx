'use client';
import React from 'react';

/* Re-anchored to design tokens, 2026-08-22. Prop signature UNCHANGED so
   _adherence.oxlintrc.json stays valid — this is strictly internal.
   · label fontSize 9 and count 10 → var(--text-xs) (11px mono floor)
   · the count badge coloured itself with the raw accent → ink-mixed
   · padding 10/16 → space tokens; the row now clears 44px
   · rgba(28,20,8,.06) → var(--hair-70) */

const inkSafe = (c) => `color-mix(in oklab, ${c} 62%, var(--ink-1))`;

export function Tabs({ tabs = [], active, onChange, accent = 'var(--accent)' }) {
  return (
    <div style={{ display: 'flex', borderBottom: '1px solid var(--hair-70)' }}>
      {tabs.map(({ id, label, count }) => {
        const on = id === active;
        return (
          <button
            key={id}
            onClick={() => onChange && onChange(id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-1)',
              minHeight: 44,
              padding: 'var(--space-3) var(--space-4)',
              background: 'transparent',
              border: 'none',
              borderBottom: `2px solid ${on ? accent : 'transparent'}`,
              marginBottom: -1,
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              letterSpacing: 'var(--tracking-wider)',
              textTransform: 'uppercase',
              color: on ? 'var(--ink-1)' : 'var(--ink-3)',
              transition: 'color var(--duration-fast) var(--ease), border-color var(--duration-fast) var(--ease)',
            }}
          >
            {label}
            {count !== undefined && (
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                fontSize: 'var(--text-xs)',
                color: on ? inkSafe(accent) : 'var(--ink-3)',
              }}>{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

'use client';
import React from 'react';

/* Re-anchored to design tokens, 2026-08-22. Prop signature UNCHANGED so
   _adherence.oxlintrc.json stays valid — this is strictly internal.
   · #ff5029 → var(--accent); borderRadius '50%' → var(--radius-pill)
   · rgba(28,20,8,.14) → var(--line-2)
   · label fontSize 14 → var(--text-base)
   · transition → var(--duration-fast) / var(--ease) */

export function Radio({ options = [], value, onChange, accent = 'var(--accent)' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      {options.map((o, i) => {
        const v = o.value ?? o;
        const lbl = o.label ?? o;
        const active = v === value;
        return (
          <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', cursor: 'pointer' }}>
            <div
              onClick={() => onChange && onChange(v)}
              style={{
                width: 18,
                height: 18,
                borderRadius: 'var(--radius-pill)',
                flexShrink: 0,
                border: `1.5px solid ${active ? accent : 'var(--line-2)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'border-color var(--duration-fast) var(--ease)',
              }}
            >
              {active && <div style={{ width: 8, height: 8, borderRadius: 'var(--radius-pill)', background: accent }} />}
            </div>
            <span style={{
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-base)',
              color: active ? 'var(--ink-1)' : 'var(--ink-3)',
            }}>{lbl}</span>
          </label>
        );
      })}
    </div>
  );
}

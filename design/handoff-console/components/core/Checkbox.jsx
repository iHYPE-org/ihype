'use client';
import React from 'react';

/* Re-anchored to design tokens, 2026-08-22. Prop signature UNCHANGED so
   _adherence.oxlintrc.json stays valid — this is strictly internal.
   · #ff5029 → var(--accent); check stroke #1c1408 → var(--ink-on-accent)
     (it sits ON the accent fill, so it is the on-accent token, not board ink)
   · borderRadius 4 → var(--radius-sm); rgba literals → var(--line-2)
   · label 14 → var(--text-base); detail 12 → var(--text-base)
   · transitions → var(--duration-fast) / var(--ease) */

export function Checkbox({ checked, onChange, label, detail, disabled, accent = 'var(--accent)' }) {
  return (
    <label style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 'var(--space-3)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.45 : 1,
    }}>
      <div
        onClick={disabled ? null : () => onChange && onChange(!checked)}
        style={{
          width: 18,
          height: 18,
          borderRadius: 'var(--radius-sm)',
          flexShrink: 0,
          marginTop: 2,
          background: checked ? accent : 'transparent',
          border: `1.5px solid ${checked ? accent : 'var(--line-2)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background var(--duration-fast) var(--ease), border-color var(--duration-fast) var(--ease)',
        }}
      >
        {checked && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
            <path d="M5 12l4 4L19 7" stroke="var(--ink-on-accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <div>
        {label && <div style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)', color: 'var(--ink-1)', lineHeight: 'var(--leading-heading)' }}>{label}</div>}
        {detail && <div style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-base)', color: 'var(--ink-3)', marginTop: 'var(--space-1)', lineHeight: 'var(--leading-body)' }}>{detail}</div>}
      </div>
    </label>
  );
}

'use client';
import React from 'react';

/* Re-anchored to design tokens, 2026-08-22. Prop signature UNCHANGED so
   _adherence.oxlintrc.json stays valid — this is strictly internal.
   · borderRadius 12 → var(--radius-panel) (3px)
   · #e6d3a4 → var(--bg-surface); rgba(28,20,8,.08) → var(--hair-80)
   · title fontSize 14 → var(--text-base); meta 12 → var(--text-base)
   
   NOTE on meta: 12 → 15px makes rows taller. That is the content floor doing its
   job — a row's secondary line is content, not an eyebrow. If a surface genuinely
   needs it smaller, it is mono metadata and should read var(--font-mono) at
   var(--text-xs), not sans at 12. */

export function ListRow({ leading, title, meta, trailing, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-4)',
        border: '1px solid var(--hair-80)',
        borderRadius: 'var(--radius-panel)',
        background: 'var(--bg-surface)',
        padding: 'var(--space-4)',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      {leading && <div style={{ flexShrink: 0 }}>{leading}</div>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--text-base)',
          fontWeight: 600,
          color: 'var(--ink-1)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>{title}</div>
        {meta && (
          <div style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-base)',
            color: 'var(--ink-2)',
            marginTop: 'var(--space-1)',
          }}>{meta}</div>
        )}
      </div>
      {trailing && <div style={{ flexShrink: 0 }}>{trailing}</div>}
    </div>
  );
}

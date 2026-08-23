'use client';
import React from 'react';

/* Re-anchored to design tokens, 2026-08-22. Prop signature UNCHANGED so
   _adherence.oxlintrc.json stays valid — this is strictly internal.
   BUG FIXED: the whole variant palette was pre-console neon —
   success #22e5d4 (cyan), info #7fb3ff (light blue), warn #ffb84a. None of those
   are console colours, and cyan-on-cream fails contrast badly. Now the semantic
   tokens: --success (teal), --warning-text, --color-error, --color-info.
   
   · borderRadius 10 → var(--radius-panel); icon tile 6 → var(--radius-sm)
   · message 13 and detail 12 → var(--text-base)
   · boxShadow rgba(0,0,0,.4) → var(--shadow-raised)
   · #e6d3a4 → var(--bg-surface) */

/* Fill and copy are separate tokens per variant: the fill can be vivid, the
   text has to pass AA on cream. Never swap one for the other. */
const TONES = {
  success: { fill: 'var(--success)',      ink: 'var(--success)' },
  warn:    { fill: 'var(--warning)',      ink: 'var(--warning-text)' },
  error:   { fill: 'var(--color-error)',  ink: 'var(--color-error)' },
  info:    { fill: 'var(--color-info)',   ink: 'var(--color-info)' },
};

const GLYPH = {
  success: <path d="M5 12l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
  warn:    <path d="M12 9v4M12 17h.01M10.3 3.6L2.6 18a1 1 0 00.87 1.5h17.1a1 1 0 00.87-1.5L13.7 3.6a1 1 0 00-1.74 0z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />,
  error:   <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />,
  info:    <><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" /><path d="M12 11v5M12 8h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></>,
};

export function Toast({ message, detail, variant = 'info', onClose }) {
  const t = TONES[variant] || TONES.info;
  const glyph = GLYPH[variant] || GLYPH.info;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 'var(--space-3)',
      padding: 'var(--space-3)',
      borderRadius: 'var(--radius-panel)',
      background: 'var(--bg-surface)',
      border: '1px solid var(--line)',
      boxShadow: 'var(--shadow-raised)',
      minWidth: 280,
      maxWidth: 380,
      fontFamily: 'var(--font-body)',
    }}>
      <div style={{
        width: 22,
        height: 22,
        borderRadius: 'var(--radius-sm)',
        background: `color-mix(in oklab, ${t.fill} 18%, transparent)`,
        color: t.ink,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        marginTop: 1,
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">{glyph}</svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--ink-1)', lineHeight: 'var(--leading-heading)' }}>{message}</div>
        {detail && (
          <div style={{ fontSize: 'var(--text-base)', color: 'var(--ink-2)', marginTop: 'var(--space-1)', lineHeight: 'var(--leading-body)' }}>{detail}</div>
        )}
      </div>
      {onClose && (
        <button onClick={onClose} aria-label="Dismiss" style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--ink-3)',
          cursor: 'pointer',
          padding: 0,
          display: 'flex',
          flexShrink: 0,
          marginTop: 2,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  );
}

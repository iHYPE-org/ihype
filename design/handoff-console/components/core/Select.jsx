'use client';
import React from 'react';

/* Re-anchored to design tokens, 2026-08-22. Prop signature UNCHANGED so
   _adherence.oxlintrc.json stays valid — this is strictly internal.
   · label 9 and hint 9 → var(--text-xs); options 14 → var(--text-base)
   · selected option coloured its text with the raw accent → ink-mixed
   · menu shadow rgba(0,0,0,.4) → var(--shadow-raised) (warm, wood-and-paper
     falloff rather than a glass drop shadow)
   · borderRadius 8 kept as var(--radius-md); the menu is a control, not a panel
   · button height 40 → 44 (touch-target floor)
   
   BUG: the menu animated 'ihype-scale-in', which is not defined in any token
   file — the animation silently did nothing. Now 'ih-pop', which base.css
   actually declares. */

const inkSafe = (c) => `color-mix(in oklab, ${c} 62%, var(--ink-1))`;

export function Select({ label, options = [], value, onChange, error, hint, style: s }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  const sel = options.find((o) => (o.value ?? o) === value);
  const display = sel ? (sel.label ?? sel) : '';

  React.useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} style={{ fontFamily: 'var(--font-body)', position: 'relative', ...s }}>
      {label && (
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-xs)',
          letterSpacing: 'var(--tracking-wider)',
          textTransform: 'uppercase',
          color: error ? 'var(--accent-text)' : 'var(--ink-3)',
          marginBottom: 'var(--space-1)',
        }}>{label}</div>
      )}
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          height: 44,
          padding: '0 var(--space-3)',
          background: 'var(--bg-surface)',
          border: `1px solid ${error ? 'var(--accent-text)' : open ? 'var(--brass)' : 'var(--line-2)'}`,
          borderRadius: 'var(--radius-md)',
          color: display ? 'var(--ink-1)' : 'var(--ink-3)',
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--text-base)',
          cursor: 'pointer',
          transition: 'border-color var(--duration-fast) var(--ease)',
        }}
      >
        <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {display || 'Select…'}
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{
          transition: 'transform var(--duration-default) var(--ease)',
          transform: open ? 'rotate(180deg)' : 'none',
          flexShrink: 0,
        }}>
          <path d="M6 9l6 6 6-6" stroke={error ? 'var(--accent-text)' : 'var(--ink-3)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + var(--space-1))',
          left: 0,
          right: 0,
          zIndex: 99,
          background: 'var(--bg-raised)',
          border: '1px solid var(--line-2)',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-raised)',
          animation: 'ih-pop var(--duration-fast) var(--ease) both',
        }}>
          {options.map((o, i) => {
            const v = o.value ?? o;
            const lbl = o.label ?? o;
            const active = v === value;
            return (
              <button
                key={i}
                type="button"
                onClick={() => { onChange && onChange(v); setOpen(false); }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  padding: 'var(--space-3)',
                  minHeight: 44,
                  background: active ? 'color-mix(in oklab, var(--accent) 10%, transparent)' : 'transparent',
                  border: 'none',
                  borderBottom: i < options.length - 1 ? '1px solid var(--line)' : 'none',
                  color: active ? inkSafe('var(--accent)') : 'var(--ink-1)',
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--text-base)',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                {active ? (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                    <path d="M5 12l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <span style={{ width: 10, flexShrink: 0 }} />
                )}
                {lbl}
              </button>
            );
          })}
        </div>
      )}
      {(hint || error) && (
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-xs)',
          letterSpacing: 'var(--tracking-wide)',
          color: error ? 'var(--accent-text)' : 'var(--ink-3)',
          marginTop: 'var(--space-1)',
        }}>{error || hint}</div>
      )}
    </div>
  );
}

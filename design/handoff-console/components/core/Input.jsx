'use client';
import React from 'react';

/* Re-anchored to design tokens, 2026-08-22. Prop signature UNCHANGED so
   _adherence.oxlintrc.json stays valid — this is strictly internal.
   BUG FIXED: the focus border was rgba(255,255,255,0.28) — a white-on-dark
   value from the retired navy direction. On the cream board that is all but
   invisible, so the field had no perceptible focus state. Now var(--brass),
   which is the console's own "this is live" cue.
   
   · error colour was raw --accent (fails AA as text) → var(--accent-text)
   · label fontSize 9 → var(--text-xs); input 14 → var(--text-base)
   · hint/error 12 → var(--text-base) — an error message is content
   · height 42 → 44 (touch-target floor)
   · #e6d3a4 → var(--bg-surface); rgba literals → var(--line-2) */

export function Input({
  label, placeholder = '', value, onChange, hint,
  leading, trailing, error, disabled = false, type = 'text',
}) {
  const [focused, setFocused] = React.useState(false);
  const borderColor = error ? 'var(--accent-text)' : focused ? 'var(--brass)' : 'var(--line-2)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', opacity: disabled ? 0.45 : 1 }}>
      {label && (
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-xs)',
          letterSpacing: 'var(--tracking-wider)',
          textTransform: 'uppercase',
          color: 'var(--ink-3)',
        }}>{label}</div>
      )}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        background: 'var(--bg-surface)',
        border: `1px solid ${borderColor}`,
        borderRadius: 'var(--radius-md)',
        padding: '0 var(--space-3)',
        height: 44,
        transition: 'border-color var(--duration-default) var(--ease)',
      }}>
        {leading && <div style={{ color: 'var(--ink-3)', display: 'flex', alignItems: 'center', flexShrink: 0 }}>{leading}</div>}
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange && onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-base)',
            fontWeight: 400,
            color: 'var(--ink-1)',
            caretColor: 'var(--accent)',
          }}
        />
        {trailing && <div style={{ color: 'var(--ink-3)', display: 'flex', alignItems: 'center', flexShrink: 0 }}>{trailing}</div>}
      </div>
      {(hint || error) && (
        <div style={{
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--text-base)',
          color: error ? 'var(--accent-text)' : 'var(--ink-3)',
        }}>{error || hint}</div>
      )}
    </div>
  );
}

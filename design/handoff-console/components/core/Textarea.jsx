'use client';
import React from 'react';

/* Re-anchored to design tokens, 2026-08-22. Prop signature UNCHANGED so
   _adherence.oxlintrc.json stays valid — this is strictly internal.
   Same focus-ring bug as Input: rgba(255,255,255,0.28) → var(--brass).
   · borderRadius 10 → var(--radius-md)
   · error colour raw accent → var(--accent-text)
   · label 9 → var(--text-xs); body 14 and hint 12 → var(--text-base) */

export function Textarea({ label, placeholder = '', value, onChange, hint, error, rows = 4, disabled = false }) {
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
      <textarea
        rows={rows}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange && onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          background: 'var(--bg-surface)',
          border: `1px solid ${borderColor}`,
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-3)',
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--text-base)',
          lineHeight: 'var(--leading-body)',
          color: 'var(--ink-1)',
          outline: 'none',
          resize: 'vertical',
          caretColor: 'var(--accent)',
          transition: 'border-color var(--duration-default) var(--ease)',
        }}
      />
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

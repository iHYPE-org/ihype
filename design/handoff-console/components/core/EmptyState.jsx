import React from 'react';

/* Re-anchored to design tokens, 2026-08-22. Prop signature UNCHANGED so
   _adherence.oxlintrc.json stays valid — this is strictly internal.
   · fontWeight 800 on Instrument Serif → 400. The family ships 400 only, so
     800 was a synthesised fake bold — same defect as StatCard.
   · title 17 → var(--text-md); detail 13 → var(--text-base)
   · borderRadius 16 → var(--radius-panel)
   · rgba(28,20,8,.08) → var(--hair-80) */

export function EmptyState({ icon, title, detail, action }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
      gap: 'var(--space-3)',
      padding: 'var(--space-12) var(--space-6)',
      border: '1px dashed var(--hair-80)',
      borderRadius: 'var(--radius-panel)',
    }}>
      {icon && <div style={{ fontSize: 'var(--text-xl)', color: 'var(--ink-3)' }}>{icon}</div>}
      <div style={{
        fontFamily: 'var(--font-display)',
        fontWeight: 400,
        fontSize: 'var(--text-md)',
        letterSpacing: 'var(--tracking-normal)',
        color: 'var(--ink-1)',
      }}>{title}</div>
      {detail && (
        <div style={{
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--text-base)',
          color: 'var(--ink-2)',
          maxWidth: 320,
          lineHeight: 'var(--leading-body)',
          textWrap: 'pretty',
        }}>{detail}</div>
      )}
      {action && <div style={{ marginTop: 'var(--space-1)' }}>{action}</div>}
    </div>
  );
}

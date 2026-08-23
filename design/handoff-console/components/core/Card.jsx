import React from 'react';

/* Re-anchored to design tokens, 2026-08-22. Original read 0 tokens.
   Prop signature is UNCHANGED so _adherence.oxlintrc.json stays valid.
   Next.js app-router ready: explicit React import, 'use client' where the
   component takes a handler. */
/* Fixed here:
   · borderRadius 10 → var(--radius-panel) (3px — a console panel has a cut
     edge, not a moulded one). This is the change that most affects how the
     whole product reads, and the one most often "softened" back.
   · backdropFilter blur(24px) removed. The console has no glass; depth comes
     from background layering (--bg-surface over --bg-base).
   · title fontSize 14 → var(--text-base); fontWeight 700 → 600, and the face
     is now var(--font-display) (Instrument Serif) per the console pass.
   · link fontSize 9 → var(--text-xs) (11px, the mono floor).
   · line rgba(28,20,8,.13) → var(--line) (.12). The .01 difference was
     meaningless divergence, not a decision. */

export function Card({ children, title, link, style }) {
  const card = {
    border: '1px solid var(--line)',
    borderRadius: 'var(--radius-panel)',
    background: 'var(--bg-surface)',
    overflow: 'hidden',
    ...style,
  };
  const header = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 'var(--space-4)',
    padding: 'var(--space-3) var(--space-4)',
    borderBottom: '1px solid var(--line)',
  };

  return (
    <section style={card}>
      {title && (
        <div style={header}>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-base)',
            fontWeight: 600,
            letterSpacing: 'var(--tracking-normal)',
            color: 'var(--ink-1)',
          }}>{title}</div>
          {link && (
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-xs)',
              letterSpacing: 'var(--tracking-wider)',
              textTransform: 'uppercase',
              color: 'var(--ink-3)',
            }}>{link}</div>
          )}
        </div>
      )}
      {children}
    </section>
  );
}

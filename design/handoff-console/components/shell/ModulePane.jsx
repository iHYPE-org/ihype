import React from 'react';

/* Re-anchored to design tokens, 2026-08-22. Prop signature UNCHANGED so
   _adherence.oxlintrc.json stays valid — this is strictly internal.
   · the on-walnut ink set is now named rather than pasted (#f6ecd9 etc.)
   · eyebrow fontSize 10 → var(--text-xs); the eyebrow also used raw --accent as
     TEXT, which fails AA → var(--accent-text)
   · title letterSpacing -.035em → var(--tracking-normal). That negative tracking
     is Bricolage's; Instrument Serif is already tight and it was over-tightening
     the largest text on every screen.
   · fontSize 46 → var(--text-3xl) (54px) — the nearest scale step. 46 was
     off-scale, sitting between --text-2xl and --text-3xl.
   · dek lineHeight 1.65 → var(--leading-body) */

/**
 * The single scroll container. `html`/`body` are locked by the shell, and this
 * is the one element that scrolls — which is what lets the map stay mounted
 * underneath and keeps the bottom-left chrome fixed relative to the frame
 * rather than to the document.
 *
 * The bottom padding is not decorative: it reserves the band the player pill
 * and logo trigger occupy, so the last row of content is never parked under
 * them.
 */
export function ModulePane({ eyebrow, title, dek, children, maxWidth = 1120, padBottom = 132 }) {
  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      overflowY: 'auto',
      overflowX: 'hidden',
      WebkitOverflowScrolling: 'touch',
      padding: `var(--space-8) var(--space-10) ${padBottom}px`,
      fontFamily: 'var(--font-body)',
      color: 'var(--ink-on-walnut)',
    }}>
      <div style={{ maxWidth, margin: '0 auto' }}>
        {eyebrow && (
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-xs)',
            letterSpacing: 'var(--tracking-widest)',
            textTransform: 'uppercase',
            color: 'var(--accent-text)',
            marginBottom: 'var(--space-3)',
          }}>{eyebrow}</div>
        )}
        {title && (
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 400,
            fontSize: 'var(--text-3xl)',
            lineHeight: 'var(--leading-display)',
            letterSpacing: 'var(--tracking-normal)',
            margin: '0 0 var(--space-2)',
            maxWidth: 780,
            textWrap: 'pretty',
          }}>{title}</h1>
        )}
        {dek && (
          <p style={{
            fontSize: 'var(--text-base)',
            lineHeight: 'var(--leading-body)',
            color: 'var(--ink-on-walnut-2)',
            maxWidth: 640,
            margin: '0 0 var(--space-6)',
            textWrap: 'pretty',
          }}>{dek}</p>
        )}
        {children}
      </div>
    </div>
  );
}

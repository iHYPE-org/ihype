'use client';
import React from 'react';

/* Re-anchored to design tokens, 2026-08-22. Prop signature UNCHANGED so
   _adherence.oxlintrc.json stays valid — this is strictly internal.
   · backdrop rgba(0,0,0,.65) + blur(4px) → var(--scrim). The token is warm
     (rgba(10,6,2,.74)); a neutral black scrim over cream reads grey-green.
   · borderRadius 16 → var(--radius-panel); close button 6 → var(--radius-sm)
   · boxShadow rgba(0,0,0,.6) → var(--shadow-raised)
   · title 17 → var(--text-md); description 13 → var(--text-base)
   · close button 28px → 44px (touch-target floor)
   
   BUG: animated 'ihype-fade-in' and 'ihype-scale-in', neither of which is
   defined in any token file — both silently did nothing. Now 'ih-fade' and
   'ih-pop', which base.css declares. */

export function Dialog({ open, title, description, children, onClose, width = 480 }) {
  if (!open) return null;
  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 200,
          background: 'var(--scrim)',
          animation: 'ih-fade var(--duration-default) var(--ease) both',
        }}
      />
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%,-50%)',
        zIndex: 201,
        width,
        maxWidth: 'calc(100vw - var(--space-8))',
        background: 'var(--bg-surface)',
        border: '1px solid var(--line-2)',
        borderRadius: 'var(--radius-panel)',
        boxShadow: 'var(--shadow-raised)',
        overflow: 'hidden',
        animation: 'ih-pop var(--duration-medium) var(--ease-spring) both',
        fontFamily: 'var(--font-body)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 'var(--space-3)',
          padding: 'var(--space-5) var(--space-5) var(--space-4)',
          borderBottom: '1px solid var(--line)',
        }}>
          <div style={{ flex: 1 }}>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 400,
              fontSize: 'var(--text-md)',
              letterSpacing: 'var(--tracking-normal)',
              color: 'var(--ink-1)',
            }}>{title}</div>
            {description && (
              <div style={{
                fontSize: 'var(--text-base)',
                color: 'var(--ink-3)',
                marginTop: 'var(--space-1)',
                lineHeight: 'var(--leading-body)',
                textWrap: 'pretty',
              }}>{description}</div>
            )}
          </div>
          {onClose && (
            <button onClick={onClose} aria-label="Close" style={{
              width: 44,
              height: 44,
              borderRadius: 'var(--radius-sm)',
              background: 'transparent',
              border: '1px solid var(--line-2)',
              color: 'var(--ink-3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
        {children && <div style={{ padding: 'var(--space-4) var(--space-5) var(--space-5)' }}>{children}</div>}
      </div>
    </>
  );
}

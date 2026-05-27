'use client';

import React from 'react';

export function Toast({ message, onUndo }: { message: string; onUndo: () => void }) {
  return (
    <div role="status" aria-live="polite" style={{
      position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
      background: 'rgba(20,20,20,.95)', backdropFilter: 'blur(12px)',
      border: '1px solid var(--line-2)', borderRadius: 10,
      padding: '10px 18px', fontFamily: 'var(--f-m)', fontSize: 12,
      color: 'var(--ink)', letterSpacing: '.04em', zIndex: 9999,
      boxShadow: '0 4px 24px rgba(0,0,0,.4)',
      animation: 'fadeIn .2s ease-out both',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <span style={{ color: '#22e5d4' }}>✓</span> {message}
      <button onClick={onUndo}
        style={{ marginLeft: 8, fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '.06em' }}>
        Undo
      </button>
    </div>
  );
}

export function WelcomeDialog({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div role="dialog" aria-modal="true" aria-label="Welcome to iHYPE" style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.72)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000,
    }}>
      <div style={{
        background: 'var(--bg-2)', border: '1px solid var(--line-2)', borderRadius: 16,
        padding: '40px 48px', maxWidth: 480, textAlign: 'center',
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🎵</div>
        <h2 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 28, letterSpacing: '-.02em', color: 'var(--ink)', margin: '0 0 14px' }}>Welcome to iHYPE</h2>
        <p style={{ fontFamily: 'var(--f-b)', fontSize: 15, color: 'var(--ink-2)', lineHeight: 1.6, margin: '0 0 10px' }}>
          Your music command center. <strong style={{ color: 'var(--ink)' }}>HYPE</strong> tracks you love.
        </p>
        <p style={{ fontFamily: 'var(--f-b)', fontSize: 15, color: 'var(--ink-2)', lineHeight: 1.6, margin: '0 0 10px' }}>
          <strong style={{ color: 'var(--ink)' }}>Seeds</strong> shows you 15-second clips of new music in your city — save what you like.
        </p>
        <p style={{ fontFamily: 'var(--f-b)', fontSize: 15, color: 'var(--ink-2)', lineHeight: 1.6, margin: '0 0 28px' }}>
          <strong style={{ color: 'var(--ink)' }}>45/45/10</strong> — every ticket, stream, and tip splits between artist, venue, and promoter. No black boxes.
        </p>
        <button
          autoFocus
          onClick={onDismiss}
          style={{
            padding: '13px 32px', borderRadius: 10, border: 'none', cursor: 'pointer',
            fontFamily: 'var(--f-m)', fontSize: 14, fontWeight: 700, letterSpacing: '.06em',
            textTransform: 'uppercase', color: '#fff',
            background: 'linear-gradient(135deg, var(--accent), var(--pink))',
          }}
        >
          Let&apos;s go
        </button>
      </div>
    </div>
  );
}

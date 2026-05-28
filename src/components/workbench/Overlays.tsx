'use client';

import React, { useEffect } from 'react';

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

// ─── Keyboard Shortcuts Dialog ───────────────────────────────

const SHORTCUTS = [
  { keys: ['Space'],          desc: 'Play / Pause' },
  { keys: ['→'],              desc: 'Next track' },
  { keys: ['←'],              desc: 'Previous track' },
  { keys: ['⌘K', 'Ctrl+K'],  desc: 'Open search' },
  { keys: ['?'],              desc: 'Show keyboard shortcuts' },
  { keys: ['Esc'],            desc: 'Close overlay' },
  { section: 'Seeds view' },
  { keys: ['←'],              desc: 'Skip seed' },
  { keys: ['↑'],              desc: 'Save seed to queue' },
  { keys: ['→'],              desc: 'Hype seed' },
  { keys: ['Space'],          desc: 'Preview seed audio' },
];

export function KeyboardShortcutsDialog({ onDismiss }: { onDismiss: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === '?') { e.preventDefault(); onDismiss(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onDismiss]);

  return (
    <div role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.72)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000,
    }} onClick={onDismiss}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-2)', border: '1px solid var(--line-2)', borderRadius: 16,
          padding: '32px 40px', width: 420, maxHeight: '80vh', overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 22, letterSpacing: '-.02em', color: 'var(--ink)', margin: 0 }}>
            Keyboard Shortcuts
          </h2>
          <button
            onClick={onDismiss}
            aria-label="Close"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 18, lineHeight: 1, padding: 4 }}
          >✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {SHORTCUTS.map((row, i) => {
            if ('section' in row) {
              return (
                <div key={i} style={{ fontFamily: 'var(--f-m)', fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--ink-3)', marginTop: 16, marginBottom: 4 }}>
                  {row.section}
                </div>
              );
            }
            return (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--line)' }}>
                <span style={{ fontFamily: 'var(--f-b)', fontSize: 13, color: 'var(--ink-2)' }}>{row.desc}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {row.keys.map(k => (
                    <kbd key={k} style={{
                      fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink)',
                      background: 'var(--bg-3)', border: '1px solid var(--line-2)',
                      borderRadius: 5, padding: '3px 8px', whiteSpace: 'nowrap',
                    }}>{k}</kbd>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 20, fontFamily: 'var(--f-m)', fontSize: 12, color: 'var(--ink-3)', textAlign: 'center', letterSpacing: '.06em' }}>
          Press <kbd style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink)', background: 'var(--bg-3)', border: '1px solid var(--line-2)', borderRadius: 4, padding: '1px 5px' }}>?</kbd> or{' '}
          <kbd style={{ fontFamily: 'var(--f-m)', fontSize: 11, color: 'var(--ink)', background: 'var(--bg-3)', border: '1px solid var(--line-2)', borderRadius: 4, padding: '1px 5px' }}>Esc</kbd> to close
        </div>
      </div>
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

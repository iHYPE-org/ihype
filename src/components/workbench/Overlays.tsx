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
      <span style={{ color: '#22e5d4', fontWeight: 800, fontSize: 14 }}>✓</span> {message}
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
          boxShadow: '0 32px 80px rgba(0,0,0,.6)',
          animation: 'fadeIn .25s ease-out both',
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

const WELCOME_STEPS = [
  {
    emoji: '🎵',
    title: 'Welcome to iHYPE',
    body: (
      <>
        A nonprofit music platform with no ticket fees. Every ticket goes{' '}
        <strong style={{ color: 'var(--ink)' }}>45%</strong> to the artist,{' '}
        <strong style={{ color: 'var(--ink)' }}>45%</strong> to the venue, and{' '}
        <strong style={{ color: 'var(--ink)' }}>10%</strong> to whoever brought the fan —{' '}
        zero to the platform.
      </>
    ),
    cta: 'Next →',
  },
  {
    emoji: '🌱',
    title: 'Your first move',
    body: (
      <>
        Go to <strong style={{ color: 'var(--ink)' }}>Seeds</strong> and swipe on a few tracks.{' '}
        Swipe <strong style={{ color: 'var(--ink)' }}>right</strong> to hype,{' '}
        <strong style={{ color: 'var(--ink)' }}>left</strong> to skip,{' '}
        <strong style={{ color: 'var(--ink)' }}>up</strong> to save. Every swipe shapes your
        local scene.
      </>
    ),
    cta: 'Next →',
  },
  {
    emoji: '⚡',
    title: 'Follow 3 artists',
    body: (
      <>
        Find artists you love in <strong style={{ color: 'var(--ink)' }}>Seeds</strong> or{' '}
        search for them. Following three unlocks a personalised feed and tells
        artists their fans are here.
      </>
    ),
    cta: 'Go to Seeds →',
  },
];

export function WelcomeDialog({ onDismiss, onNavigate }: { onDismiss: () => void; onNavigate?: (view: string) => void }) {
  const [step, setStep] = React.useState(0);
  const current = WELCOME_STEPS[step];
  const isLast = step === WELCOME_STEPS.length - 1;

  function handleCta() {
    if (!isLast) { setStep(s => s + 1); } else { onNavigate?.('seeds'); onDismiss(); }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Welcome to iHYPE" style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.72)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000,
    }}>
      <div style={{
        background: 'var(--bg-2)',
        border: '1px solid var(--line-2)',
        borderRadius: 20,
        padding: '40px 48px',
        maxWidth: 480,
        textAlign: 'center',
        boxShadow: '0 32px 80px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.05)',
        animation: 'fadeIn .3s ease-out both',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, var(--accent), #ff3e9a)', borderRadius: '20px 20px 0 0' }} />
        <div style={{ fontSize: 48, marginBottom: 16 }}>{current.emoji}</div>
        <h2 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 28, letterSpacing: '-.02em', color: 'var(--ink)', margin: '0 0 14px' }}>{current.title}</h2>
        <p style={{ fontFamily: 'var(--f-b)', fontSize: 15, color: 'var(--ink-2)', lineHeight: 1.6, margin: '0 0 28px' }}>
          {current.body}
        </p>
        <button
          autoFocus
          onClick={handleCta}
          style={{
            padding: '13px 32px', borderRadius: 10, border: 'none', cursor: 'pointer',
            fontFamily: 'var(--f-m)', fontSize: 14, fontWeight: 700, letterSpacing: '.06em',
            textTransform: 'uppercase', color: '#fff', width: '100%',
            background: 'linear-gradient(135deg, var(--accent), #ff3e9a)',
            boxShadow: '0 4px 20px rgba(255,80,41,.35)',
            transition: 'transform .1s, box-shadow .1s',
          }}
        >
          {current.cta}
        </button>
        {/* Step dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 20 }}>
          {WELCOME_STEPS.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === step ? 20 : 6, height: 6, borderRadius: 3,
                background: i === step ? 'var(--accent)' : 'var(--line-2)',
                transition: 'width .2s, background .2s',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

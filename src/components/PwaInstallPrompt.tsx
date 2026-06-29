'use client';

import { useEffect, useState } from 'react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

const DISMISS_KEY = 'ihype:pwa-install-dismissed';
const VISIT_KEY = 'ihype:visit-count';
const MIN_VISITS = 2;

function getVisitCount(): number {
  try { return Number(window.localStorage.getItem(VISIT_KEY) ?? '0'); } catch { return 0; }
}

function incrementVisitCount(): number {
  try {
    const next = getVisitCount() + 1;
    window.localStorage.setItem(VISIT_KEY, String(next));
    return next;
  } catch { return 0; }
}

export function PwaInstallPrompt() {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (window.localStorage.getItem(DISMISS_KEY) === '1') return;
    } catch {
      // ignore
    }
    const visits = incrementVisitCount();
    if (visits < MIN_VISITS) return;

    function onPrompt(e: Event) {
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);
      // Delay display so it doesn't interrupt the user immediately
      setTimeout(() => setVisible(true), 8_000);
    }
    window.addEventListener('beforeinstallprompt', onPrompt as EventListener);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt as EventListener);
  }, []);

  if (!visible || !evt) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // ignore
    }
    setVisible(false);
  }

  async function install() {
    if (!evt) return;
    try {
      await evt.prompt();
      await evt.userChoice;
    } catch {
      // ignore
    }
    setVisible(false);
  }

  return (
    <div
      role="dialog"
      aria-label="Add iHYPE to home screen"
      style={{
        position: 'fixed',
        left: 12, right: 12,
        bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
        zIndex: 60,
        margin: '0 auto',
        maxWidth: 440,
        background: 'rgba(16,13,9,.96)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,.12)',
        borderRadius: 16,
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 13,
        boxShadow: '0 20px 56px rgba(0,0,0,.6)',
        animation: 'pwa-slide-up .3s cubic-bezier(.4,0,.2,1) both',
      }}
    >
      <style>{`@keyframes pwa-slide-up{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* App icon */}
      <div style={{
        width: 44, height: 44, borderRadius: 11, flexShrink: 0,
        background: 'linear-gradient(135deg, #ff5029, #ff3e6e)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22, fontWeight: 900, color: '#fff', fontFamily: 'system-ui',
        boxShadow: '0 4px 14px rgba(255,80,41,.35)',
      }}>
        H
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-display, system-ui)', fontWeight: 700, fontSize: 14, color: '#f0ebe5', marginBottom: 2 }}>
          Add iHYPE to your home screen
        </div>
        <div style={{ fontFamily: 'var(--font-body, system-ui)', fontSize: 12, color: 'rgba(240,235,229,.45)', lineHeight: 1.4, marginBottom: 12 }}>
          Instant access to shows, music, and your fans.
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={install}
            style={{
              padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: '#ff5029', color: '#fff',
              fontFamily: 'var(--font-mono, monospace)', fontSize: 11, fontWeight: 700, letterSpacing: '.06em',
            }}
          >
            Add to Home Screen
          </button>
          <button
            type="button"
            onClick={dismiss}
            style={{
              padding: '7px 12px', borderRadius: 8, cursor: 'pointer',
              background: 'none', border: '1px solid rgba(255,255,255,.1)',
              fontFamily: 'var(--font-mono, monospace)', fontSize: 11, color: 'rgba(240,235,229,.4)', letterSpacing: '.04em',
            }}
          >
            Not now
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        style={{
          background: 'none', border: 'none', color: 'rgba(240,235,229,.3)',
          cursor: 'pointer', padding: 4, fontSize: 18, lineHeight: 1, flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}

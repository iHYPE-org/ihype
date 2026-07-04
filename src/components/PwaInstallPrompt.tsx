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

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

// iOS Safari never fires beforeinstallprompt, and other iOS browsers (CriOS,
// FxiOS, etc.) don't support installable web apps the same way — only detect
// Safari itself so we don't show install instructions that won't work.
function isIOSSafari(): boolean {
  const ua = window.navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
  const isOtherIOSBrowser = /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return isIOS && !isOtherIOSBrowser;
}

export function PwaInstallPrompt() {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [iosPrompt, setIosPrompt] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (window.localStorage.getItem(DISMISS_KEY) === '1') return;
    } catch {
      // ignore
    }
    const visits = incrementVisitCount();
    if (visits < MIN_VISITS) return;

    if (isStandalone()) return;

    if (isIOSSafari()) {
      setTimeout(() => setIosPrompt(true), 8_000);
      return;
    }

    function onPrompt(e: Event) {
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);
      // Delay display so it doesn't interrupt the user immediately
      setTimeout(() => setVisible(true), 8_000);
    }
    window.addEventListener('beforeinstallprompt', onPrompt as EventListener);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt as EventListener);
  }, []);

  function dismissIos() {
    try {
      window.localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // ignore
    }
    setIosPrompt(false);
  }

  if (iosPrompt) {
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
          <div style={{ fontFamily: 'var(--font-body, system-ui)', fontSize: 12, color: 'rgba(240,235,229,.6)', lineHeight: 1.5 }}>
            Tap <strong style={{ color: '#f0ebe5' }}>Share</strong>{' '}
            <span aria-hidden="true" style={{ display: 'inline-flex', verticalAlign: 'middle', margin: '0 2px' }}>
              <svg width="13" height="16" viewBox="0 0 24 28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v16M6 8l6-6 6 6M4 16v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              </svg>
            </span>{' '}
            below, then <strong style={{ color: '#f0ebe5' }}>Add to Home Screen</strong>.
          </div>
        </div>
        <button
          type="button"
          onClick={dismissIos}
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
        <div style={{ fontFamily: 'var(--font-body, system-ui)', fontSize: 12, color: 'rgba(240,235,229,.55)', lineHeight: 1.4, marginBottom: 12 }}>
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
              fontFamily: 'var(--font-mono, monospace)', fontSize: 11, color: 'rgba(240,235,229,.5)', letterSpacing: '.04em',
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

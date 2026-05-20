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
      setVisible(true);
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
        left: 12,
        right: 12,
        bottom: 12,
        zIndex: 60,
        margin: '0 auto',
        maxWidth: 480,
        background: 'var(--bg-2, #100d09)',
        border: '1px solid var(--line-2, rgba(255,255,255,.14))',
        borderRadius: 12,
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        boxShadow: '0 18px 42px rgba(0,0,0,.4)'
      }}
    >
      <div style={{ flex: 1, fontSize: 13, color: 'var(--ink, #f0ebe5)' }}>
        Add <strong>iHYPE</strong> to your home screen for faster access.
      </div>
      <button
        type="button"
        onClick={install}
        style={{
          background: 'var(--accent, #ff5029)',
          color: '#0a0805',
          border: 'none',
          borderRadius: 6,
          padding: '7px 12px',
          fontWeight: 700,
          cursor: 'pointer'
        }}
      >
        Install
      </button>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        style={{
          background: 'transparent',
          color: 'var(--ink-2, #9e9080)',
          border: '1px solid var(--line-2, rgba(255,255,255,.14))',
          borderRadius: 6,
          padding: '7px 10px',
          cursor: 'pointer'
        }}
      >
        ✕
      </button>
    </div>
  );
}

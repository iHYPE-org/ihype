'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'ihype_cookie_consent';

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      // localStorage unavailable — skip banner rather than show it every load
    }
  }, []);

  function choose(value: 'all' | 'essential') {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // best-effort
    }
    window.dispatchEvent(new CustomEvent('ihype:cookie-consent', { detail: value }));
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie preferences"
      className="ihype-cookie-consent"
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 'max(16px, env(safe-area-inset-bottom))',
        transform: 'translateX(-50%)',
        zIndex: 400,
        width: 'min(560px, calc(100vw - 32px))',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '0.75rem 1rem',
        padding: '1rem 1.25rem',
        borderRadius: 16,
        background: 'var(--bg-3, #1a1612)',
        border: '1px solid var(--line-2, var(--line-2))',
        boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
        fontFamily: "var(--font-body, 'DM Sans', sans-serif)",
      }}
    >
      <p style={{ flex: '1 1 260px', margin: 0, fontSize: 13, color: 'var(--ink-2, #9e9080)', lineHeight: 1.5 }}>
        We use essential cookies to keep you signed in, and optional analytics cookies to understand usage in aggregate.{' '}
        <Link href="/legal?tab=privacy" style={{ color: 'var(--accent, #ff5029)', textDecoration: 'underline' }}>Read our privacy policy</Link>.
      </p>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button
          onClick={() => choose('essential')}
          className="ihype-btn-ghost"
          style={{ fontSize: 13 }}
        >
          Essential only
        </button>
        <button
          onClick={() => choose('all')}
          className="ihype-btn-primary"
          style={{ fontSize: 13, padding: '10px 18px' }}
        >
          Accept all
        </button>
      </div>
      <style>{`
        /* Clear the fixed mobile bottom nav (60px + safe-area) instead of
           sitting underneath it — the nav has a higher z-index and a solid
           background, so without this the accept/decline buttons are
           unreachable on phones. */
        @media (max-width: 768px) {
          .ihype-cookie-consent {
            bottom: calc(68px + env(safe-area-inset-bottom, 0px)) !important;
          }
        }
      `}</style>
    </div>
  );
}

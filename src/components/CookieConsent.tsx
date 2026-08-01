'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useI18n } from '@/components/I18nProvider';

const STORAGE_KEY = 'ihype_cookie_consent';

export function CookieConsent() {
  const { t } = useI18n();
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
        right: 16,
        bottom: 'max(16px, env(safe-area-inset-bottom))',
        zIndex: 400,
        width: 'min(430px, calc(100vw - 32px))',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '0.75rem 1rem',
        padding: '0.75rem 0.875rem',
        borderRadius: 12,
        background: 'var(--bg-3)',
        border: '1px solid var(--line-2)',
        boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
        fontFamily: "var(--font-body, 'DM Sans', sans-serif)",
      }}
    >
      <p style={{ flex: '1 1 230px', margin: 0, fontSize: 11, color: 'var(--ink-2)', lineHeight: 1.45 }}>
        {t('cookieConsent.description', 'We use essential cookies to keep you signed in, and optional analytics cookies to understand usage in aggregate.')}{' '}
        <Link href="/info?tab=privacy" style={{ color: 'var(--accent-text, var(--accent))', textDecoration: 'underline' }}>{t('cookieConsent.privacyLink', 'Read our privacy policy')}</Link>.
      </p>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button
          onClick={() => choose('essential')}
          className="ihype-btn-ghost"
          style={{ minHeight: 36, fontSize: 11 }}
        >
          {t('cookieConsent.essentialOnly', 'Essential only')}
        </button>
        <button
          onClick={() => choose('all')}
          className="ihype-btn-primary"
          style={{ minHeight: 36, fontSize: 11, padding: '8px 14px' }}
        >
          {t('cookieConsent.acceptAll', 'Accept all')}
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

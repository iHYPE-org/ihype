'use client';

/* global-error REPLACES the root layout, so nothing the layout imports is on
   the page — until 2026-09-24 this body painted `var(--bg)` and
   `rgba(var(--accent-rgb), …)` with no stylesheet defining either, beside a
   literal DS8 off-white, so "Something broke." was near-white on white.
   Importing the token sheet here is what makes the tokens real (row 513). */
import './globals.css';
import { useEffect } from 'react';
import { useI18n } from '@/components/I18nProvider';
import { loadBrowserSentry } from '@/lib/browser-sentry';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();

  useEffect(() => {
    // Through the one shared loader (row 512): it resolves at once when the
    // page is already up, and a root render failure is reported the moment
    // the SDK is — never by a second import of the chunk.
    void loadBrowserSentry().then((Sentry) => {
      Sentry.captureException(error);
    }).catch(() => { /* no SDK, nothing to report to */ });
  }, [error]);

  return (
    <html>
      <body style={{
        background: 'var(--bg)', color: 'var(--ink)', fontFamily: 'var(--font-body)', margin: 0,
        minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '40px 24px', textAlign: 'center',
      }}>
        <div style={{
          width: 72, height: 72, borderRadius: 20, background: 'rgba(var(--accent-rgb),.08)', border: '1px solid rgba(var(--accent-rgb),.18)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 28,
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(var(--accent-rgb),0.8)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
          </svg>
        </div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 5vw, 40px)', fontWeight: 800, letterSpacing: '-.03em', lineHeight: .95, margin: '0 0 16px' }}>
          {t('globalError.heading', 'Something broke.')}
        </h2>
        <p style={{ fontSize: '0.9375rem', color: 'var(--ink-3)', maxWidth: 380, lineHeight: 1.6, margin: '0 0 24px' }}>
          {error.digest ? `${t('globalError.errorIdPrefix', 'Error ID:')} ${error.digest}` : t('globalError.unexpectedMessage', 'An unexpected error occurred. If it keeps happening, email admin@ihype.org.')}
        </p>
        <button
          onClick={reset}
          style={{ padding: '14px 28px', background: 'var(--accent)', color: 'var(--ink-on-accent)', border: 'none', borderRadius: 10, fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 800, cursor: 'pointer' }}
        >
          {t('globalError.tryAgain', 'Try again')}
        </button>
      </body>
    </html>
  );
}

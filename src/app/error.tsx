'use client';

import { useEffect } from 'react';
import { useI18n } from '@/components/I18nProvider';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  useEffect(() => {
    console.error(error);
  }, [error]);

  const isDev = process.env.NODE_ENV === 'development';

  return (
    <div style={{ minHeight: '40vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center' }}>
      <div style={{
        width: 72, height: 72, borderRadius: 20, background: 'rgba(var(--accent-rgb),.08)', border: '1px solid rgba(var(--accent-rgb),.18)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 28,
      }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(var(--accent-rgb),0.8)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
        </svg>
      </div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 5vw, 40px)', fontWeight: 800, letterSpacing: '-.03em', lineHeight: .95, margin: '0 0 16px', color: 'var(--ink)' }}>
        {t('error.title', 'Something broke.')}
      </h1>
      <p style={{ fontSize: '0.9375rem', color: 'var(--ink-a65)', maxWidth: 380, lineHeight: 1.6, margin: '0 0 24px' }}>
        {t('error.description', 'An unexpected error occurred. If it keeps happening, email admin@ihype.org.')}
      </p>
      {error.digest && (
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--ink-a65)', marginBottom: 24 }}>
          {t('error.errorIdLabel', 'Error ID:')} {error.digest}
        </p>
      )}
      {isDev && error.message && (
        <pre style={{ fontSize: '0.9375rem', textAlign: 'left', background: 'var(--bg-3)', padding: 12, borderRadius: 6, maxWidth: '100%', overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginBottom: 16 }}>
          {error.message}
          {error.stack ? `\n\n${error.stack}` : ''}
        </pre>
      )}
      <button
        onClick={reset}
        style={{
          padding: '14px 28px', background: 'var(--accent)', color: 'var(--ink-on-accent)', border: 'none', borderRadius: 10,
          fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 800, cursor: 'pointer',
        }}
      >
        {t('error.tryAgain', 'Try again')}
      </button>
    </div>
  );
}

'use client';

import { useI18n } from '@/components/I18nProvider';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  return (
    <html>
      <body style={{
        background: 'var(--bg)', color: '#eef1f6', fontFamily: "'Work Sans', sans-serif",
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
        <h2 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 'clamp(28px, 5vw, 40px)', fontWeight: 800, letterSpacing: '-.03em', lineHeight: .95, margin: '0 0 16px' }}>
          {t('globalError.heading', 'Something broke.')}
        </h2>
        <p style={{ fontSize: 15, color: 'rgba(238,241,246,.6)', maxWidth: 380, lineHeight: 1.6, margin: '0 0 24px' }}>
          {error.digest ? `${t('globalError.errorIdPrefix', 'Error ID:')} ${error.digest}` : t('globalError.unexpectedMessage', 'An unexpected error occurred. If it keeps happening, email admin@ihype.org.')}
        </p>
        <button
          onClick={reset}
          style={{ padding: '14px 28px', background: 'var(--accent)', color: 'var(--ink-on-accent)', border: 'none', borderRadius: 10, fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 16, fontWeight: 800, cursor: 'pointer' }}
        >
          {t('globalError.tryAgain', 'Try again')}
        </button>
      </body>
    </html>
  );
}

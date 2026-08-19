'use client';

import { useEffect } from 'react';
import { useI18n } from '@/components/I18nProvider';

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  useEffect(() => {
    console.error('[admin]', error);
  }, [error]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '40vh', gap: 16, textAlign: 'center', padding: '2rem' }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>{t('adminError.title', 'Admin panel error')}</h2>
      <p className="meta">{error.message || t('adminError.fallbackMessage', 'An unexpected error occurred.')}</p>
      {error.digest && <p className="meta" style={{ fontSize: '0.9375rem', opacity: 0.6 }}>{t('adminError.errorIdLabel', 'Error ID:')} {error.digest}</p>}
      <button className="button secondary small" onClick={reset}>{t('adminError.tryAgain', 'Try again')}</button>
    </div>
  );
}

'use client';

import { useEffect } from 'react';
import { useI18n } from '@/components/I18nProvider';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16, textAlign: 'center', padding: '2rem' }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>{t('fansSlugError.title', 'Something went wrong')}</h2>
      <p className="meta">{t('fansSlugError.description', "This fan profile couldn't load. Try refreshing.")}</p>
      {error.digest && <p className="meta" style={{ fontSize: '0.75rem', opacity: 0.6 }}>{t('fansSlugError.errorIdLabel', 'Error ID:')} {error.digest}</p>}
      <button className="button secondary small" onClick={reset}>{t('fansSlugError.tryAgain', 'Try again')}</button>
    </div>
  );
}

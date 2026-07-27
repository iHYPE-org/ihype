import { getLocale, getT } from '@/lib/i18n/server';

export default async function RadioStudioLoading() {
  const t = getT(await getLocale());
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0a0805', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontFamily: 'var(--font-jb, monospace)', fontSize: 10, letterSpacing: '.18em', color: '#5a5048' }}>{t('radioStudioLoading.loading', 'LOADING STUDIO…')}</div>
    </div>
  );
}

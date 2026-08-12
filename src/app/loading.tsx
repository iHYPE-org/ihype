import { getServerT } from '@/lib/i18n/server';

export default async function Loading() {
  const t = await getServerT();
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh', opacity: 0.4, fontSize: '0.875rem' }}>
      {t('loading.loadingIndicator', 'Loading…')}
    </div>
  );
}

import { getLocale, getT } from '@/lib/i18n/server';

export default async function Loading() {
  const t = getT(await getLocale());
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }}>
      <p className="meta">{t('adminAdsLoading.loading', 'Loading…')}</p>
    </div>
  );
}

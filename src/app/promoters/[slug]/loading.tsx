import { getServerT } from '@/lib/i18n/server';

export default async function Loading() {
  const t = await getServerT();
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <p className="meta">{t('promotersSlugLoading.loading', 'Loading…')}</p>
    </div>
  );
}

import { getServerT } from '@/lib/i18n/server';

export default async function Loading() {
  const t = await getServerT();
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }}>
      <p className="meta">{t('adminJournalLoading.loading', 'Loading…')}</p>
    </div>
  );
}

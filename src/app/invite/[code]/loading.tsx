import { getServerT } from '@/lib/i18n/server';

export default async function InviteLoading() {
  const t = await getServerT();
  return (
    <div className="route-state" data-busy aria-busy="true">
      <p>{t('inviteCodeLoading.loading', 'Loading invite…')}</p>
    </div>
  );
}

import { getServerT } from '@/lib/i18n/server';

export default async function InviteLoading() {
  const t = await getServerT();
  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <div className="animate-pulse text-sm text-gray-400">{t('inviteCodeLoading.loading', 'Loading invite…')}</div>
    </div>
  );
}

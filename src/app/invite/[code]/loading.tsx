import { getLocale, getT } from '@/lib/i18n/server';

export default async function InviteLoading() {
  const t = getT(await getLocale());
  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <div className="animate-pulse text-sm text-gray-400">{t('inviteCodeLoading.loading', 'Loading invite…')}</div>
    </div>
  );
}

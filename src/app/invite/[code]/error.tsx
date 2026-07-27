'use client';

import { useI18n } from '@/components/I18nProvider';

export default function InviteError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 p-8 text-center">
      <p className="text-sm text-gray-500">{t('inviteCodeError.message', 'This invite link could not be loaded.')}</p>
      <button onClick={reset} className="text-sm underline">
        {t('inviteCodeError.tryAgain', 'Try again')}
      </button>
    </div>
  );
}

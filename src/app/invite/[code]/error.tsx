'use client';

import { useI18n } from '@/components/I18nProvider';

export default function InviteError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  return (
    <div className="route-state" role="alert">
      <p>{t('inviteCodeError.message', 'This invite link could not be loaded.')}</p>
      <button type="button" onClick={reset} className="button">
        {t('inviteCodeError.tryAgain', 'Try again')}
      </button>
    </div>
  );
}

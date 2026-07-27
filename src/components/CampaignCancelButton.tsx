'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/components/I18nProvider';

type Action = 'cancel' | 'pause' | 'resume' | 'retry-checkout';

export function CampaignCancelButton({ campaignId, status }: { campaignId: string; status: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, setPending] = useState<Action | null>(null);

  const CONFIRM_COPY: Partial<Record<Action, string>> = {
    cancel: t('campaignCancelButton.confirmCancel', "Cancel this campaign? It will stop running immediately and can't be resumed."),
    pause: t('campaignCancelButton.confirmPause', 'Pause this campaign? It stops running until you resume it — your remaining run length is preserved.'),
    resume: t('campaignCancelButton.confirmResume', 'Resume this campaign?'),
  };

  async function act(action: Action) {
    const confirmCopy = CONFIRM_COPY[action];
    if (confirmCopy && !window.confirm(confirmCopy)) return;
    setPending(action);
    const res = await fetch('/api/advertise/campaigns', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: campaignId, action }),
    });
    if (res.ok) {
      if (action === 'retry-checkout') {
        const data = (await res.json()) as { checkoutUrl?: string };
        if (data.checkoutUrl) {
          window.location.href = data.checkoutUrl;
          return;
        }
      }
      router.refresh();
    } else {
      setPending(null);
    }
  }

  if (status === 'AWAITING_PAYMENT') {
    return (
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="button small" disabled={pending !== null} onClick={() => act('retry-checkout')} type="button">
          {pending === 'retry-checkout' ? t('campaignCancelButton.redirecting', 'Redirecting…') : t('campaignCancelButton.payNow', 'Pay now →')}
        </button>
        <button className="button small secondary" disabled={pending !== null} onClick={() => act('cancel')} type="button">
          {pending === 'cancel' ? t('campaignCancelButton.cancelling', 'Cancelling…') : t('campaignCancelButton.cancel', 'Cancel')}
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {status === 'APPROVED' && (
        <button className="button small secondary" disabled={pending !== null} onClick={() => act('pause')} type="button">
          {pending === 'pause' ? t('campaignCancelButton.pausing', 'Pausing…') : t('campaignCancelButton.pause', 'Pause')}
        </button>
      )}
      {status === 'PAUSED' && (
        <button className="button small" disabled={pending !== null} onClick={() => act('resume')} type="button">
          {pending === 'resume' ? t('campaignCancelButton.resuming', 'Resuming…') : t('campaignCancelButton.resume', 'Resume')}
        </button>
      )}
      <button className="button small secondary" disabled={pending !== null} onClick={() => act('cancel')} type="button">
        {pending === 'cancel' ? t('campaignCancelButton.cancelling', 'Cancelling…') : t('campaignCancelButton.cancelCampaign', 'Cancel campaign')}
      </button>
    </div>
  );
}

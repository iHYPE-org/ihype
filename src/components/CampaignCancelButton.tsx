'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/components/I18nProvider';
import { REFUND_WINDOW_BUSINESS_DAYS } from '@/lib/ad-settlement-plan';

type Action = 'cancel' | 'pause' | 'resume' | 'retry-checkout';

/**
 * `charged` + `unspentCents` let the cancel confirm say what the advertiser is
 * about to get back, in dollars, before they agree — "can't be resumed" on
 * its own reads as "you lose the money", which is the opposite of what
 * happens. After the PATCH the row re-renders from the settlement record
 * (amount, date, Stripe refund reference), so the promise made here is
 * checkable against what was actually done.
 */
export function CampaignCancelButton({
  campaignId,
  status,
  charged = false,
  unspentCents = 0,
}: { campaignId: string; status: string; charged?: boolean; unspentCents?: number }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, setPending] = useState<Action | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refundLine = charged
    ? unspentCents > 0
      ? ` ${t('campaignCancelButton.refundUnspent', 'The unspent')} $${(unspentCents / 100).toFixed(2)} ${t('campaignCancelButton.refundUnspentTail', `of your budget is refunded to the card you paid with, usually within ${REFUND_WINDOW_BUSINESS_DAYS} business days.`)}`
      : ` ${t('campaignCancelButton.refundNoneDelivered', 'Your whole budget has been delivered, so there is nothing to refund.')}`
    : ` ${t('campaignCancelButton.refundNotCharged', 'Nothing has been charged, so there is nothing to refund.')}`;

  const CONFIRM_COPY: Partial<Record<Action, string>> = {
    // New key on purpose: the older translations of confirmCancel omit the
    // refund, and a stale translation here would contradict the money.
    cancel: t('campaignCancelButton.confirmCancelRefund', "Cancel this campaign? It stops running immediately and can't be resumed.") + refundLine,
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
      const data = (await res.json()) as { checkoutUrl?: string; settlement?: string };
      if (action === 'retry-checkout') {
        if (data.checkoutUrl) {
          window.location.href = data.checkoutUrl;
          return;
        }
      }
      // The settlement sentence names the amount, the timing and the Stripe
      // reference; it is shown immediately rather than only in the email.
      if (action === 'cancel' && data.settlement) setNotice(data.settlement);
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
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      {notice && <p className="meta" role="status" style={{ flexBasis: '100%', margin: 0 }}>{notice}</p>}
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

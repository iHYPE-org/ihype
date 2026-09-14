'use client';

import { useI18n } from '@/components/I18nProvider';

export function PayoutActions({ title }: { title: string }) {
  const { t } = useI18n();
  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: `${title} · ${t('payoutActions.shareTitleSuffix', 'Payout receipt')}`, url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url).catch(() => {});
      alert(t('payoutActions.copiedAlert', 'Receipt link copied to clipboard.'));
    }
  }

  return (
    <div style={{ display: 'flex', gap: 10 }}>
      {/* THE SHELL'S OWN KEYS, NOT A THIRD BUTTON VOCABULARY. Both were written
          as ~14 inline properties each, so no stylesheet floor could reach them
          and the widened census read them at 38px on desktop (DESIGN_SYNC row
          414). `.mmm-btn-ghost`/`.mmm-btn-primary` carry the unconditional
          44px floor and paint from the key tokens — row 375's rule for a surface
          that needs a button. */}
      <button className="mmm-btn-ghost" onClick={() => window.print()} type="button">
        {t('payoutActions.downloadPdf', 'Download PDF')}
      </button>
      <button className="mmm-btn-primary" onClick={share} type="button">
        {t('payoutActions.shareReceipt', 'Share receipt')}
      </button>
    </div>
  );
}

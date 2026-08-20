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
      <button
        onClick={() => window.print()}
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: '1px solid var(--line, var(--hair-100))', borderRadius: 999, cursor: 'pointer', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '0.9375rem', background: 'transparent', color: 'var(--ink)', padding: '9px 18px' }}
        type="button"
      >
        {t('payoutActions.downloadPdf', 'Download PDF')}
      </button>
      <button
        onClick={share}
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: 'none', borderRadius: 999, cursor: 'pointer', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '0.9375rem', background: 'var(--accent)', color: 'var(--ink-on-accent)', padding: '9px 18px', boxShadow: '0 4px 20px rgba(var(--accent-rgb),.3)' }}
        type="button"
      >
        {t('payoutActions.shareReceipt', 'Share receipt')}
      </button>
    </div>
  );
}

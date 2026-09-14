import type { Locale } from '@/lib/i18n/locales';
import { formatDate, formatUsd } from '@/lib/format-locale';
import Link from 'next/link';
import { getServerI18n } from '@/lib/i18n/server';

type PayableEntry = {
  id: string;
  amountCents: number;
  payeeLabel: string;
  paidAt: Date | null;
  show: { title: string; slug: string; status?: string } | null;
};

function fmtCents(cents: number, locale: Locale) {
  return formatUsd(locale, cents, 2);
}

/** Extracted verbatim from the former standalone `/me/payouts` page (DESIGN_SYNC row 245) — same real data, same markup, now reusable from the `/payouts` tabbed hub. */
export async function PayoutsHistoryPanel({ released, pending }: { released: PayableEntry[]; pending: PayableEntry[] }) {
  const { locale, t } = await getServerI18n();
  const totalReleasedCents = released.reduce((sum, e) => sum + e.amountCents, 0);

  return (
    <div>
      <p className="meta" style={{ marginBottom: 24 }}>
        {t('payoutsHistoryPanel.subtitle', 'Every payout your profiles have actually received — real Stripe transfers, not a projection.')}
      </p>

      <div className="panel" style={{ padding: '14px 20px', marginBottom: 24, display: 'flex', gap: 24 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1.5rem' }}>{fmtCents(totalReleasedCents, locale)}</div>
          <div className="meta">{t('payoutsHistoryPanel.totalReceived', 'Total received')}</div>
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1.5rem' }}>{released.length}</div>
          <div className="meta">{t('payoutsHistoryPanel.payoutsCount', 'Payouts')}</div>
        </div>
      </div>

      {released.length === 0 && pending.length === 0 && (
        <p className="meta">{t('payoutsHistoryPanel.emptyState', "No payouts yet. They're released automatically once a ticketed show you're booked on ends.")}</p>
      )}

      {released.length > 0 && (
        <>
          <h2 style={{ fontSize: '1.1rem', marginBottom: 12 }}>{t('payoutsHistoryPanel.receivedHeading', 'Received')}</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
            {released.map((entry) => (
              <div key={entry.id} className="panel" style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>
                    {entry.show ? <Link href={`/shows/${entry.show.slug}`}>{entry.show.title}</Link> : entry.payeeLabel}
                  </div>
                  <div className="meta">{entry.payeeLabel} · {entry.paidAt ? formatDate(locale, new Date(entry.paidAt), { year: 'numeric', month: 'numeric', day: 'numeric' }) : ''}</div>
                </div>
                <div style={{ fontWeight: 700, color: 'var(--role-venue)' }}>{fmtCents(entry.amountCents, locale)}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {pending.length > 0 && (
        <>
          <h2 style={{ fontSize: '1.1rem', marginBottom: 12 }}>{t('payoutsHistoryPanel.pendingHeading', 'Pending')}</h2>
          <p className="meta" style={{ marginBottom: 12 }}>
            {t('payoutsHistoryPanel.pendingNote', 'Released automatically once the show ends.')}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {pending.map((entry) => (
              <div key={entry.id} className="panel" style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>
                    {entry.show ? <Link href={`/shows/${entry.show.slug}`}>{entry.show.title}</Link> : entry.payeeLabel}
                  </div>
                  <div className="meta">{entry.payeeLabel} · {entry.show?.status ?? ''}</div>
                </div>
                <div style={{ fontWeight: 700 }}>{fmtCents(entry.amountCents, locale)}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

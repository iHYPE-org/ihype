import type { Locale } from '@/lib/i18n/locales';
import { formatDate, formatNumber, formatUsd } from '@/lib/format-locale';
import Link from 'next/link';
import { getServerI18n } from '@/lib/i18n/server';
import { isTruncatedList } from '@/lib/list-counts';
import { PAYOUT_HOLD_DAYS, describePayableRelease } from '@/lib/payout-release';
import { payoutReleaseLabel } from '@/lib/i18n-enum-labels';

type PayableEntry = {
  id: string;
  amountCents: number;
  payeeLabel: string;
  paidAt: Date | null;
  show: { title: string; slug: string; status?: string } | null;
};

/** A PENDING entry carries what `describePayableRelease` needs to judge it. */
type PendingEntry = PayableEntry & {
  category: string;
  /** Does the payee profile hold a Stripe Connect account id? */
  hasPayoutDestination: boolean;
  show: { title: string; slug: string; status?: string; startsAt?: Date } | null;
};

function fmtCents(cents: number, locale: Locale) {
  return formatUsd(locale, cents, 2);
}

/**
 * Extracted verbatim from the former standalone `/me/payouts` page
 * (DESIGN_SYNC row 245) — same real data, same markup, now reusable from the
 * `/payouts` tabbed hub.
 *
 * THE TILES ARE AGGREGATES AND THE LISTS ARE A PAGE (row 459). "Total
 * received" used to be `released.reduce(...)` over the 100 rows the page
 * takes, so a profile past 100 released payables read a lifetime total that
 * silently omitted the older ones, beside a "Payouts" count that could only
 * ever read 100. Both figures come from the caller's own aggregate now, and
 * a capped list says so rather than reading as the whole history.
 *
 * AND A PENDING ROW SAYS WHAT IT IS ACTUALLY WAITING FOR. One sentence —
 * "Released automatically once the show ends" — used to sit over every
 * pending entry, and it was wrong three ways at once: a TAX_* entry is never
 * released by anything (remittance is manual, by design), a payee with no
 * Stripe Connect account is skipped on every run for ever, and even when both
 * are in order the release is PAYOUT_HOLD_DAYS after the show, not the night
 * of it. `describePayableRelease()` is the one place those conditions live —
 * `triggerShowPayouts()` reads the same constants — so the promise and the
 * cron cannot drift apart again.
 */
export async function PayoutsHistoryPanel({
  released,
  pending,
  releasedTotal,
  releasedTotalCents,
  pendingTotal,
}: {
  released: PayableEntry[];
  pending: PendingEntry[];
  /** Every RELEASED entry these profiles hold, not the page below. */
  releasedTotal: number;
  releasedTotalCents: number;
  pendingTotal: number;
}) {
  const { locale, t } = await getServerI18n();
  /* One clock for the whole list: two rows judged a millisecond apart could
     otherwise straddle a hold boundary and read as disagreeing. */
  const now = new Date();
  const showingRecent = (shown: number, total: number) =>
    isTruncatedList(shown, total)
      ? t('payoutsHistoryPanel.showingRecent', 'Showing the {shown} most recent of {total}.')
          .replace('{shown}', formatNumber(locale, shown))
          .replace('{total}', formatNumber(locale, total))
      : null;

  return (
    <div>
      <p className="meta" style={{ marginBottom: 24 }}>
        {t('payoutsHistoryPanel.subtitle', 'Every payout your profiles have actually received — real Stripe transfers, not a projection.')}
      </p>

      <div className="panel" style={{ padding: '14px 20px', marginBottom: 24, display: 'flex', gap: 24 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1.5rem' }}>{fmtCents(releasedTotalCents, locale)}</div>
          <div className="meta">{t('payoutsHistoryPanel.totalReceived', 'Total received')}</div>
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1.5rem' }}>{formatNumber(locale, releasedTotal)}</div>
          <div className="meta">{t('payoutsHistoryPanel.payoutsCount', 'Payouts')}</div>
        </div>
      </div>

      {released.length === 0 && pending.length === 0 && (
        <p className="meta">{t('payoutsHistoryPanel.emptyState', "No payouts yet. They're released automatically once a ticketed show you're booked on ends.")}</p>
      )}

      {released.length > 0 && (
        <>
          <h2 style={{ fontSize: '1.1rem', marginBottom: 12 }}>{t('payoutsHistoryPanel.receivedHeading', 'Received')}</h2>
          {showingRecent(released.length, releasedTotal) ? (
            <p className="meta" style={{ marginBottom: 12 }}>{showingRecent(released.length, releasedTotal)}</p>
          ) : null}
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
          {showingRecent(pending.length, pendingTotal) ? (
            <p className="meta" style={{ marginBottom: 12 }}>{showingRecent(pending.length, pendingTotal)}</p>
          ) : null}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {pending.map((entry) => {
              const state = describePayableRelease(
                {
                  category: entry.category,
                  hasPayoutDestination: entry.hasPayoutDestination,
                  show: entry.show?.status && entry.show.startsAt
                    ? { status: entry.show.status, startsAt: new Date(entry.show.startsAt) }
                    : null,
                },
                now,
              );
              return (
                <div key={entry.id} className="panel" style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>
                      {entry.show ? <Link href={`/shows/${entry.show.slug}`}>{entry.show.title}</Link> : entry.payeeLabel}
                    </div>
                    <div className="meta">{entry.payeeLabel}</div>
                    <div className="meta" style={{ marginTop: 4 }}>
                      {payoutReleaseLabel(t, state.kind, {
                        holdDays: PAYOUT_HOLD_DAYS,
                        releasesOn: state.kind === 'holding'
                          ? formatDate(locale, state.releasesOn, { year: 'numeric', month: 'short', day: 'numeric' })
                          : undefined,
                      })}
                    </div>
                  </div>
                  <div style={{ fontWeight: 700, flexShrink: 0 }}>{fmtCents(entry.amountCents, locale)}</div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

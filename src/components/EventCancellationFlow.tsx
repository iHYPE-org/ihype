'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useI18n } from '@/components/I18nProvider';

const REASONS = [
  { value: 'artist', label: 'Artist can no longer perform' },
  { value: 'venue', label: 'Venue issue / closure' },
  { value: 'low-sales', label: 'Low ticket sales' },
  { value: 'other', label: 'Other' },
] as const;

type Result = { ordersRefunded: number; ordersSkippedAlreadyScanned: number; ordersFailed: number };

/**
 * Event Cancellation Flow (DESIGN_SYNC row 227) — real POST to
 * /api/shows/[showId]/cancel, which refunds every captured order in full
 * via Stripe and voids every reserved one. Shows the ACTUAL counts the API
 * returns (refunded / already-attended-so-skipped / failed), not a blanket
 * "everyone's refunded" success screen regardless of what really happened.
 */
export function EventCancellationFlow({
  showId,
  showSlug,
  showTitle,
  venueName,
  startsAtLabel,
  ticketsSoldCount,
  dashboardHref,
}: {
  showId: string;
  showSlug: string;
  showTitle: string;
  venueName: string | null;
  startsAtLabel: string;
  ticketsSoldCount: number;
  dashboardHref: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [reason, setReason] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  async function confirm() {
    if (!reason) return;
    if (!window.confirm(t('eventCancellationFlow.confirmPrompt', 'Cancel this event and refund every ticket holder? This cannot be undone.'))) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/shows/${showId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? t('eventCancellationFlow.cancelError', 'Could not cancel the event — try again.'));
        setSubmitting(false);
        return;
      }
      setResult(data);
    } catch {
      setError(t('eventCancellationFlow.networkError', 'Network error — try again.'));
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="ecf-page">
        <div className="ecf-done">
          <div className="ecf-done-icon">✕</div>
          <h1 className="ecf-done-title">{t('eventCancellationFlow.doneTitle', 'Event cancelled.')}</h1>
          <p className="ecf-done-body">
            {/* Whole sentences per plural form. These used to read
                `{n} order{s} {t(predicate)}`, which left the noun hardcoded in
                English while the predicate was translated — Spanish rendered
                "3 orders reembolsadas por completo…". Splitting on the noun
                also breaks gender agreement, since the predicate has to agree
                with a noun the translator cannot see. */}
            {(result.ordersRefunded === 1
              ? t('eventCancellationFlow.refundedSummaryOne', "{count} order refunded in full — face value plus Stripe's processing fee.")
              : t('eventCancellationFlow.refundedSummaryOther', "{count} orders refunded in full — face value plus Stripe's processing fee.")
            ).replace('{count}', result.ordersRefunded.toLocaleString())}
            {result.ordersSkippedAlreadyScanned > 0 && ` ${(result.ordersSkippedAlreadyScanned === 1
              ? t('eventCancellationFlow.skippedSummaryOne', '{count} order was already scanned in and was left untouched.')
              : t('eventCancellationFlow.skippedSummaryOther', '{count} orders were already scanned in and were left untouched.')
            ).replace('{count}', result.ordersSkippedAlreadyScanned.toLocaleString())}`}
            {result.ordersFailed > 0 && ` ${(result.ordersFailed === 1
              ? t('eventCancellationFlow.failedSummaryOne', '{count} refund failed and will need manual follow-up — check Stripe.')
              : t('eventCancellationFlow.failedSummaryOther', '{count} refunds failed and will need manual follow-up — check Stripe.')
            ).replace('{count}', result.ordersFailed.toLocaleString())}`}
          </p>
          <Link className="ecf-btn ecf-btn-solid" href={dashboardHref}>{t('eventCancellationFlow.backToDashboard', 'Back to dashboard →')}</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="ecf-page">
      <div className="ecf-eyebrow">{t('eventCancellationFlow.eyebrow', 'Cancel Event')}</div>
      <h1 className="ecf-title">{t('eventCancellationFlow.title', 'Cancel this event?')}</h1>

      <div className="ecf-card">
        <div className="ecf-card-title">{showTitle}{venueName ? ` @ ${venueName}` : ''}</div>
        <div className="ecf-card-meta">{startsAtLabel} · {ticketsSoldCount.toLocaleString()} {ticketsSoldCount === 1
          ? t('eventCancellationFlow.ticketsSoldLabelOne', 'ticket sold')
          : t('eventCancellationFlow.ticketsSoldLabelOther', 'tickets sold')}</div>
      </div>

      <div className="ecf-reasons">
        {REASONS.map((r) => (
          <label className="ecf-reason-row" key={r.value}>
            <input checked={reason === r.value} name="reason" onChange={() => setReason(r.value)} type="radio" />
            {t(`eventCancellationFlow.reason.${r.value}`, r.label)}
          </label>
        ))}
      </div>

      <div className="ecf-warning">
        <div className="ecf-warning-label">{t('eventCancellationFlow.warningLabel', "This can't be undone")}</div>
        <p>
          {/* Two whole sentences rather than one with {s}/{verb} slots: the slots
              were filled with English "s"/"is"/"are", which leaked into every
              non-English locale and cannot express Slavic, CJK or Arabic number
              agreement at all. */}
          {(ticketsSoldCount === 1
            ? t('eventCancellationFlow.warningBodyOne', 'All {count} ticket is refunded in full automatically — face value and Stripe\'s processing fee both. Fans are notified immediately.')
            : t('eventCancellationFlow.warningBodyOther', 'All {count} tickets are refunded in full automatically — face value and Stripe\'s processing fee both. Fans are notified immediately.')
          ).replace('{count}', ticketsSoldCount.toLocaleString())}
        </p>
      </div>

      {error && <p className="ecf-error">{error}</p>}

      <button className="ecf-btn ecf-btn-danger" disabled={!reason || submitting} onClick={confirm} type="button">
        {submitting ? t('eventCancellationFlow.cancelling', 'Cancelling…') : t('eventCancellationFlow.confirmButton', 'Cancel event & refund everyone →')}
      </button>
      <Link className="ecf-btn ecf-btn-outline" href={`/shows/${showSlug}`}>
        {t('eventCancellationFlow.keepEvent', 'Keep the event')}
      </Link>

      <style>{`
        .ecf-page { max-width: 440px; margin: 0 auto; padding: 40px 20px 80px; }
        .ecf-eyebrow { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: .14em; text-transform: uppercase; color: var(--accent, #ff5029); margin-bottom: 10px; }
        .ecf-title { font-family: var(--font-display); font-size: 26px; font-weight: 800; letter-spacing: -.03em; margin: 0 0 20px; color: var(--ink); }
        .ecf-card { border: 1px solid var(--line); border-radius: var(--radius-lg); background: var(--bg2); padding: 18px 20px; margin-bottom: 20px; }
        .ecf-card-title { font-family: var(--font-display); font-weight: 800; font-size: 15px; color: var(--ink); }
        .ecf-card-meta { font-size: 12px; color: var(--ink-a55); margin-top: 3px; }
        .ecf-reasons { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; }
        .ecf-reason-row { display: flex; align-items: center; gap: 10px; font-size: 13.5px; color: var(--ink); padding: 10px 4px; }
        .ecf-warning { margin-top: 4px; margin-bottom: 20px; padding: 14px 16px; border-radius: var(--radius-md); border: 1px solid rgba(255,80,41,.25); background: rgba(255,80,41,.06); }
        .ecf-warning-label { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: .08em; text-transform: uppercase; color: var(--accent, #ff5029); margin-bottom: 4px; }
        .ecf-warning p { font-size: 12.5px; color: var(--ink-a60); line-height: 1.6; margin: 0; }
        .ecf-error { color: var(--accent, #ff5029); font-size: 12.5px; margin: 0 0 12px; }
        .ecf-btn { display: block; text-align: center; font-family: var(--font-mono); font-size: 13px; text-transform: uppercase; letter-spacing: .06em; padding: 12px 20px; border-radius: var(--radius-pill); border: none; cursor: pointer; text-decoration: none; margin-bottom: 8px; }
        .ecf-btn-danger { background: var(--accent, #ff5029); color: #fff; width: 100%; }
        .ecf-btn-outline { background: transparent; color: var(--ink-a70); border: 1px solid var(--line); }
        .ecf-btn:disabled { opacity: 0.6; cursor: default; }
        .ecf-btn-solid { background: var(--accent, #ff5029); color: #fff; }
        .ecf-done { text-align: center; }
        .ecf-done-icon { width: 56px; height: 56px; border-radius: 16px; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; background: rgba(255,80,41,.12); border: 2px solid var(--accent, #ff5029); color: var(--accent, #ff5029); font-size: 24px; }
        .ecf-done-title { font-family: var(--font-display); font-weight: 800; font-size: 26px; letter-spacing: -.03em; color: var(--ink); margin: 0; }
        .ecf-done-body { font-size: 14px; color: var(--ink-a60); line-height: 1.65; max-width: 34ch; margin: 8px auto 24px; }
      `}</style>
    </div>
  );
}

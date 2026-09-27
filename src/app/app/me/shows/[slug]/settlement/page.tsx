import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { formatDate, formatDoorTime, formatUsd } from '@/lib/format-locale';
import { getServerI18n } from '@/lib/i18n/server';
import { isAdminSession } from '@/lib/permissions';
import { StatementPaymentActions, StatementVenueLines } from '@/components/SettlementActions';
import { describePayoutMethod } from '@/lib/split-agreement-data';
import { settlementDateFor } from '@/lib/split-agreement';
import { paymentState, type PaymentState } from '@/lib/settlement-statement';
import { loadShowSettlement, statementFor } from '@/lib/settlement-statement-data';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Settlement statement · iHYPE', robots: { index: false, follow: false } };
}

/**
 * The Settlement Statement (Show Revenue Split Agreement, Section 6): what the
 * show took, what came off, and what the venue owes each act by the
 * Settlement Date — with the payment record both sides keep. The venue sees
 * every act; an act sees the show's totals and its own line only.
 */
export default async function SettlementPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  const { locale, t } = await getServerI18n();
  const { slug } = await params;
  if (!session?.user?.id) redirect(`/login?callbackUrl=/app/me/shows/${slug}/settlement`);

  const show = await db.show.findUnique({
    where: { slug },
    select: { id: true, slug: true, title: true, startsAt: true, timeZone: true, status: true, cancelledByActProfileId: true, venueProfile: { select: { ownerId: true, name: true } } },
  });
  if (!show || !show.venueProfile) return notFound();

  const loaded = await loadShowSettlement(show.id);
  const isVenue = show.venueProfile.ownerId === session.user.id;
  const isAdmin = isAdminSession(session);
  const mine = loaded.agreements.filter((a) => a.artistProfile.ownerId === session.user.id);
  if (!isVenue && !isAdmin && mine.length === 0) return notFound();

  const cancelled = show.status === 'CANCELED';
  const { netCents, grossCents, refundFeesCents, lines } = statementFor(
    loaded,
    cancelled ? { cancelled: true, byActProfileId: show.cancelledByActProfileId } : { cancelled: false },
  );
  const causingAct = cancelled && show.cancelledByActProfileId
    ? loaded.agreements.find((a) => a.artistProfileId === show.cancelledByActProfileId)?.artistProfile.name ?? null
    : null;
  const visible = isVenue || isAdmin ? loaded.agreements : mine;
  const now = new Date();
  const started = show.startsAt <= now;
  const due = settlementDateFor(show.startsAt);
  const money = (cents: number) => formatUsd(locale, cents, 2);
  const stateLabel = (state: PaymentState) => {
    switch (state) {
      case 'NOT_DUE': return t('settlementPage.stateNotDue', 'Not due yet');
      case 'DUE': return t('settlementPage.stateDue', 'Due');
      case 'OVERDUE': return t('settlementPage.stateOverdue', 'Overdue');
      case 'MARKED_PAID': return t('settlementPage.stateMarkedPaid', 'Marked paid — awaiting the artist');
      case 'COMPLETE': return t('settlementPage.stateComplete', 'Paid');
      case 'REPORTED': return t('settlementPage.stateReported', 'Non-payment reported');
    }
  };

  return (
    <div className="stl-page">
      <div className="stl-eyebrow">{t('settlementPage.eyebrow', 'Settlement statement')}</div>
      <h1 className="stl-title">{show.title}</h1>
      <p className="stl-sub">
        {formatDoorTime(locale, show.startsAt, show.timeZone)} · {show.venueProfile.name} · {t('settlementPage.dueBy', 'Artist shares due by')}{' '}
        {formatDate(locale, due, { month: 'long', day: 'numeric', year: 'numeric', ...(show.timeZone ? { timeZone: show.timeZone } : {}) })}
      </p>
      {!started && <p className="stl-note">{t('settlementPage.provisional', 'The show has not started. These figures are provisional until it ends.')}</p>}
      {cancelled && (
        <p className="stl-note">
          {causingAct
            ? t('settlementPage.cancelledByActNote', 'This show was cancelled because {act} cancelled or did not appear. {act} is owed nothing and reimburses the venue for the fees Stripe kept on the refunds (Section 7.4). Every other act is owed the cancellation amount below (7.3). If the cause was outside anyone\'s control, each side bears its own costs instead (7.5).').replaceAll('{act}', causingAct)
            : t('settlementPage.cancelledByVenueNote', 'This show was cancelled by the venue. The venue bears the fees Stripe kept on the refunds and owes each act the cancellation amount below (Section 7.3). If the cause was outside anyone\'s control, each side bears its own costs instead (7.5).')}
        </p>
      )}

      <section className="stl-card" aria-labelledby="stl-totals">
        <h2 id="stl-totals" className="stl-h2">{t('settlementPage.totalsTitle', 'Ticket receipts')}</h2>
        <dl className="stl-rows">
          <div><dt>{t('settlementPage.ticketsSold', 'Tickets sold through iHYPE')}</dt><dd>{loaded.summary.ticketsSold}</dd></div>
          <div><dt>{t('settlementPage.grossIhype', 'Gross through iHYPE (price + tax)')}</dt><dd>{money(loaded.summary.grossCents)}</dd></div>
          <div><dt>{t('settlementPage.offPlatform', 'Admission sold outside iHYPE')}</dt><dd>{money(loaded.offPlatformCents)}</dd></div>
          <div><dt>{t('settlementPage.gross', 'Gross Ticket Receipts')}</dt><dd>{money(grossCents)}</dd></div>
          <div><dt>{t('settlementPage.lessTax', 'Less sales tax')}</dt><dd>−{money(loaded.summary.taxCents)}</dd></div>
          <div><dt>{t('settlementPage.lessRefunds', 'Less refunds')} ({loaded.summary.ticketsRefunded})</dt><dd>−{money(loaded.summary.refundsCents)}</dd></div>
          <div><dt>{t('settlementPage.lessChargebacks', 'Less chargebacks lost')}</dt><dd>−{money(loaded.chargebacksLostCents)}</dd></div>
          <div className="stl-total"><dt>{t('settlementPage.net', 'Net Ticket Receipts')}</dt><dd>{money(netCents)}</dd></div>
          {cancelled && (
            <div>
              <dt>
                {causingAct
                  ? t('settlementPage.refundFeesByAct', 'Stripe fees kept on the refunds (estimate), owed by {act}').replace('{act}', causingAct)
                  : t('settlementPage.refundFeesByVenue', 'Stripe fees kept on the refunds (estimate), borne by the venue')}
              </dt>
              <dd>{money(refundFeesCents)}</dd>
            </div>
          )}
        </dl>
        {loaded.statement?.offPlatformNote && <p className="stl-meta">{t('settlementPage.offPlatformNote', 'Outside iHYPE:')} {loaded.statement.offPlatformNote}</p>}
        {loaded.statement?.chargebacksNote && <p className="stl-meta">{t('settlementPage.chargebacksNote', 'Chargebacks:')} {loaded.statement.chargebacksNote}</p>}
        {isVenue && started && (
          <StatementVenueLines
            chargebacksLostCents={loaded.chargebacksLostCents}
            chargebacksNote={loaded.statement?.chargebacksNote ?? null}
            offPlatformCents={loaded.offPlatformCents}
            offPlatformNote={loaded.statement?.offPlatformNote ?? null}
            showId={show.id}
          />
        )}
      </section>

      {visible.map((a) => {
        const line = lines.find((l) => l.agreementId === a.id)!;
        const p = a.payment;
        const state = paymentState({
          now, showStartsAt: show.startsAt,
          paidMarkedAt: p?.paidMarkedAt ?? null, artistConfirmedAt: p?.artistConfirmedAt ?? null,
          reportedAt: p?.reportedAt ?? null, reportResolvedAt: p?.reportResolvedAt ?? null,
        });
        const isMine = a.artistProfile.ownerId === session.user!.id;
        const owed = cancelled ? line.venueCancellationCents ?? 0 : line.artistShareCents;
        return (
          <section className="stl-card" key={a.id} aria-label={a.artistProfile.name}>
            <div className="stl-card-head">
              <h2 className="stl-h2">{a.artistProfile.name}</h2>
              <span className={`stl-pill stl-pill-${state.toLowerCase()}`}>{stateLabel(state)}</span>
            </div>
            <dl className="stl-rows">
              <div><dt>{t('settlementPage.split', 'Split Percentage')}</dt><dd>{line.splitPercent}%</dd></div>
              {line.deductionCapCents > 0 && (
                <div><dt>{t('settlementPage.deductions', 'Approved deductions applied')}</dt><dd>−{money(line.deductionsAppliedCents)} / {money(line.deductionCapCents)}</dd></div>
              )}
              <div><dt>{t('settlementPage.bySplit', 'Split × net')}</dt><dd>{money(line.bySplitCents)}</dd></div>
              {line.guaranteeCents ? <div><dt>{t('settlementPage.guarantee', 'Guarantee')}</dt><dd>{money(line.guaranteeCents)}</dd></div> : null}
              <div className="stl-total"><dt>{cancelled ? t('settlementPage.cancellationOwedToAct', 'Owed to this act on cancellation') : t('settlementPage.artistShare', 'Artist Share')}</dt><dd>{money(owed)}</dd></div>
              {line.artistOwesRefundFeesCents !== null && (
                <div><dt>{t('settlementPage.actOwesFees', 'This act reimburses the venue (7.4)')}</dt><dd>{money(line.artistOwesRefundFeesCents)}</dd></div>
              )}
            </dl>
            {(isVenue || isAdmin) && (
              <p className="stl-meta">
                {t('settlementPage.payTo', 'Pay to:')} {describePayoutMethod(a.artistProfile.payoutMethodKind, a.artistProfile.payoutMethodDetails) ?? a.artistPaymentMethod}
              </p>
            )}
            {p?.paidMarkedAt && (
              <p className="stl-meta">
                {t('settlementPage.paidRecord', 'Venue recorded:')} {money(p.paidAmountCents ?? 0)} · {p.paidOn ? formatDate(locale, p.paidOn, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : ''} · {p.paidMethod} · {p.paidReference}
              </p>
            )}
            {p?.reportedAt && !p.reportResolvedAt && <p className="stl-meta">{t('settlementPage.reportRecord', 'Artist reported:')} {p.reportNote}</p>}
            {started && isVenue && (
              <StatementPaymentActions
                agreementId={a.id}
                canReport={false}
                confirmed={state === 'COMPLETE' && Boolean(p?.artistConfirmedAt)}
                deductionCapCents={line.deductionCapCents}
                deductionsAppliedCents={line.deductionsAppliedCents}
                role="venue"
                suggestedCents={owed}
              />
            )}
            {started && isMine && (
              <StatementPaymentActions
                agreementId={a.id}
                canReport={Boolean(p?.paidMarkedAt) || now > due}
                confirmed={Boolean(p?.artistConfirmedAt)}
                deductionCapCents={0}
                deductionsAppliedCents={0}
                role="artist"
                suggestedCents={0}
              />
            )}
          </section>
        );
      })}

      <p className="stl-foot">
        <Link href={`/app/me/shows/${show.slug}/lineup`}>{t('settlementPage.backToLineup', 'Lineup and signed agreements')}</Link>
      </p>

      <style>{`
        .stl-page { max-width: 680px; margin: 0 auto; padding: 32px 24px 100px; }
        .stl-eyebrow { font-family: var(--font-mono); font-size: 0.6875rem; letter-spacing: .14em; text-transform: uppercase; color: var(--ink-a65); }
        .stl-title { font-family: var(--font-display); font-size: 1.625rem; font-weight: 800; margin: 6px 0; color: var(--ink); }
        .stl-sub, .stl-note, .stl-meta { font-size: 0.9375rem; color: var(--ink-a65); line-height: 1.6; }
        .stl-note { padding: 12px 14px; border: 1px solid var(--line); border-radius: var(--radius-md); }
        .stl-card { border: 1px solid var(--line); border-radius: var(--radius-lg); background: var(--bg2); padding: 18px 20px; margin-top: 16px; }
        .stl-card-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
        .stl-h2 { font-family: var(--font-display); font-weight: 800; font-size: 1.0625rem; margin: 0 0 10px; color: var(--ink); }
        .stl-rows { margin: 0; display: flex; flex-direction: column; gap: 6px; }
        .stl-rows > div { display: flex; justify-content: space-between; gap: 12px; font-size: 0.9375rem; color: var(--ink-2); }
        .stl-rows dd { margin: 0; font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
        .stl-total { border-top: 1px solid var(--line); padding-top: 8px; font-weight: 600; color: var(--ink); }
        .stl-pill { flex-shrink: 0; font-family: var(--font-mono); font-size: 0.9375rem; padding: 5px 10px; border-radius: var(--radius-pill); background: rgba(var(--warning-rgb),.15); color: var(--warning-text); }
        .stl-pill-complete { background: rgba(var(--role-venue-rgb),.15); color: var(--role-venue); }
        .stl-pill-reported, .stl-pill-overdue { background: rgba(var(--accent-rgb),.15); color: var(--accent-text); }
        .stl-foot { margin-top: 24px; font-size: 0.9375rem; }
        .stl-foot a { color: var(--ink-a65); display: inline-flex; min-height: 44px; align-items: center; }
        .sa-form { margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--line); display: flex; flex-direction: column; gap: 10px; }
        .sa-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        @media (max-width: 560px) { .sa-grid { grid-template-columns: 1fr; } }
        .sa-row { display: flex; gap: 10px; align-items: flex-end; flex-wrap: wrap; }
        .sa-form label { display: flex; flex-direction: column; gap: 4px; font-size: 0.9375rem; color: var(--ink-a65); }
        .sa-form input, .sa-form textarea { background: var(--bg); border: 1px solid var(--line); border-radius: var(--radius-md); padding: 9px 12px; color: var(--ink); font-size: 1rem; min-height: 44px; box-sizing: border-box; }
        .sa-form textarea { min-height: 88px; }
        .sa-btn { font-family: var(--font-mono); font-size: 0.9375rem; text-transform: uppercase; letter-spacing: .06em; padding: 10px 18px; border-radius: var(--radius-pill); border: none; cursor: pointer; background: var(--accent); color: var(--ink-on-accent); min-height: 44px; align-self: flex-start; }
        .sa-btn-ghost { background: transparent; color: var(--ink-a70); border: 1px solid var(--line); }
        .sa-btn:disabled { opacity: .6; cursor: default; }
        .sa-status { font-size: 0.9375rem; color: var(--ink-a65); }
        .sa-error { color: var(--accent-text); font-size: 0.9375rem; margin: 0; }
      `}</style>
    </div>
  );
}

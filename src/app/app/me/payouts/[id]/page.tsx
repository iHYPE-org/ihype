import type { Locale } from '@/lib/i18n/locales';
import { formatDoorTime, formatNumber, formatUsd } from '@/lib/format-locale';
import { redirect } from 'next/navigation';
import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import Link from 'next/link';
import type { Metadata } from 'next';
import { PayoutFanView } from '@/components/PayoutFanView';
import { PayoutActions } from '@/components/PayoutActions';
import { getServerI18n } from '@/lib/i18n/server';
import { isShowOrganizer } from '@/lib/show-organizer';
import { PAYOUT_HOLD_DAYS } from '@/lib/payout-release';
import { stripeCutOf } from '@/lib/stripe-fees';
import { VENUE_SHARE_PERCENT } from '@/lib/ticketing';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const show = await db.show.findFirst({
    where: { OR: [{ id }, { slug: id }] },
    select: { title: true },
  });
  return {
    title: show ? `Payout · ${show.title} · iHYPE` : 'Payout · iHYPE',
    robots: { index: false, follow: false },
  };
}

function fmtCents(cents: number, locale: Locale) {
  return formatUsd(locale, cents, 0);
}

export default async function PayoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { locale, t } = await getServerI18n();
  const session = await auth();
  if (!session?.user?.id) {
    const { id } = await params;
    redirect(`/login?callbackUrl=/app/me/payouts/${id}`);
  }

  const { id } = await params;

  const show = await db.show.findFirst({
    where: { OR: [{ id }, { slug: id }] },
    select: {
      id: true, slug: true, title: true, status: true, creatorId: true,
      startsAt: true, timeZone: true, endsAt: true, isTicketed: true,
      ticketPriceCents: true, ticketCapacity: true, ticketsSoldCount: true,
      artistPayoutPercent: true, venuePayoutPercent: true, promoterPayoutPercent: true,
      headlinerProfile: { select: { name: true, slug: true, type: true, ownerId: true } },
      venueProfile: { select: { name: true, slug: true, city: true, ownerId: true } },
      promoterProfile: { select: { name: true, slug: true } },
    },
  });

  /* The organiser set, not the creator alone: the public show page links here
     for the venue's and the headliner's owner too, and both are parties to the
     split this page explains (DESIGN_SYNC row 446). A stranger still reads 404. */
  if (!show || !isShowOrganizer(session, show)) notFound();

  /* WHAT WAS ACTUALLY CHARGED, NOT WHAT THE FACE VALUE MULTIPLIES OUT TO.
   *
   * Until 2026-09-15 this page computed `ticketPriceCents * ticketsSoldCount`
   * and headlined it "Where the money went. Here's every dollar, accounted
   * for." It read no order, no payable, no Connect account and not even the
   * show's status — so it was a financial statement to the act assembled from
   * two columns and three percentages, and it was wrong in three ways at once:
   *
   *   * `ticketsSoldCount` increments at RESERVATION, inside the transaction
   *     that creates a RESERVED order, and only comes back down when one is
   *     voided. Seats held by a checkout nobody completed read as money.
   *   * The three cells applied the show's configured percentages to that
   *     figure. The real split is on the ORDER, computed at purchase, and it
   *     is not what the percentages multiply out to — at the time, a missing
   *     HYPE link redistributed the promoter share; since 2026-09-25 Stripe's
   *     fee comes off the face value before the 75/25, so no percentage of
   *     the face value is anyone's share.
   *   * Past tense over a show that had not happened and money nothing had
   *     collected.
   *
   * Every figure below is now summed from the rows that hold it. None of the
   * reads is caught: a money page must reach the error boundary rather than
   * render a smaller number (the payouts hub's own rule, DESIGN_SYNC row 459).
   */
  const [capturedOrders, reservedOrders, payablesByStatus] = await Promise.all([
    db.ticketOrder.aggregate({
      where: { showId: show.id, status: 'CAPTURED' },
      _sum: {
        quantity: true, subtotalCents: true,
        artistPayoutCents: true, venuePayoutCents: true, promoterPayoutCents: true,
      },
      _count: { _all: true },
    }),
    db.ticketOrder.aggregate({
      where: { showId: show.id, status: 'RESERVED' },
      _sum: { quantity: true },
    }),
    db.accountsPayableEntry.groupBy({
      by: ['status'],
      where: { showId: show.id },
      _sum: { amountCents: true },
    }),
  ]);

  const priceCents = show.ticketPriceCents ?? 0;
  const sold = show.ticketsSoldCount ?? 0;
  const capacity = show.ticketCapacity ?? 0;
  const paidTickets = capturedOrders._sum.quantity ?? 0;
  const heldTickets = reservedOrders._sum.quantity ?? 0;
  const collectedCents = capturedOrders._sum.subtotalCents ?? 0;
  const hasMoney = collectedCents > 0;

  const releasedCents = payablesByStatus.find((row) => row.status === 'RELEASED')?._sum.amountCents ?? 0;
  const heldPayableCents = payablesByStatus.find((row) => row.status === 'PENDING')?._sum.amountCents ?? 0;

  /* With money collected, the shares are the SUM of what each order recorded
     and the percentages are derived from them — never the other way round.
     Stripe's fee is what the face value left over after the shares: since
     2026-09-25 it comes off the top before the 75/25, and on an order sold
     under the old terms (buyer paid the fee on top, 70/20/10) it is zero. A
     promoter share can only exist on those older orders and is drawn only
     when one does. With nothing collected this is openly a projection of one
     ticket at the current terms, and the copy below says so. */
  const projectedFeeCents = priceCents > 0 ? stripeCutOf(priceCents) : 0;
  const projectedNetCents = Math.max(0, priceCents - projectedFeeCents);
  const projectedVenueCents = Math.round(projectedNetCents * (VENUE_SHARE_PERCENT / 100));
  const artistCents = hasMoney
    ? (capturedOrders._sum.artistPayoutCents ?? 0)
    : projectedNetCents - projectedVenueCents;
  const venueCents = hasMoney
    ? (capturedOrders._sum.venuePayoutCents ?? 0)
    : projectedVenueCents;
  const promoterCents = hasMoney ? (capturedOrders._sum.promoterPayoutCents ?? 0) : 0;
  const feeCents = hasMoney
    ? Math.max(0, collectedCents - artistCents - venueCents - promoterCents)
    : projectedFeeCents;

  const shareBase = hasMoney ? collectedCents : priceCents;
  const pctOf = (cents: number) => (shareBase > 0 ? Math.round((cents / shareBase) * 1000) / 10 : 0);
  const artistPct = pctOf(artistCents);
  const venuePct = pctOf(venueCents);
  const promoterPct = pctOf(promoterCents);
  const feePct = pctOf(feeCents);

  const dateStr = formatDoorTime(locale, new Date(show.startsAt), show.timeZone, {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });

  const CELLS = [
    { label: t('payoutIdPage.artist', 'Artist'), pct: artistPct, cents: artistCents, color: 'var(--accent-text)', name: show.headlinerProfile?.name, href: show.headlinerProfile ? `/app/artists/${show.headlinerProfile.slug}` : null },
    { label: t('payoutIdPage.venue', 'Venue'), pct: venuePct, cents: venueCents, color: 'var(--role-venue)', name: show.venueProfile?.name, href: show.venueProfile ? `/app/venues/${show.venueProfile.slug}` : null },
    {
      label: t('payoutIdPage.stripeFee', 'Stripe card fee'),
      pct: feePct,
      cents: feeCents,
      color: 'var(--ink-3)',
      name: 'Stripe',
      href: null,
      note: hasMoney
        ? t('payoutIdPage.stripeFeeNote', 'Taken off the face value before the split. Orders sold before 25 September 2026 carried the fee on top, so it reads zero for those.')
        : t('payoutIdPage.stripeFeeEstimate', 'Estimated at the standard US card rate. It comes off the face value before the split.'),
    },
    /* Historical only. The promoter share was retired on 2026-09-25; it can
       exist only on orders sold under the old split, and a cell reading $0.00
       for a payment nobody can receive any more would be a claim, not a
       figure. */
    ...(promoterCents > 0 ? [{
      label: t('payoutIdPage.pastReferrers', 'HYPE link referrers'),
      pct: promoterPct,
      cents: promoterCents,
      color: 'var(--ink-2)',
      name: show.promoterProfile?.name ?? t('payoutIdPage.referrersSharedPoolPast', 'Referrers under the old split'),
      href: show.promoterProfile ? `/app/artists/${show.promoterProfile.slug}` : null,
      note: t('payoutIdPage.pastReferrersNote', 'Paid on orders sold before 25 September 2026, when a HYPE link earned a share.'),
    }] : []),
  ];

  return (
    <div style={{ width: '100%', maxWidth: 620, margin: '0 auto', padding: '32px 16px 60px' }}>

      {/* Hero */}
      <div className="payout-card" style={{
        borderRadius: 24, padding: '2.5rem',
        background: 'var(--bg-2)',
        border: '1px solid var(--line)', marginBottom: '1.25rem', position: 'relative', overflow: 'hidden',
      }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9375rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 16 }}>
          {t('payoutIdPage.postEventPayout', 'Post-event payout')} · {dateStr}
        </p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(1.8rem,5vw,2.8rem)', letterSpacing: '-.04em', lineHeight: .95, marginBottom: 6, color: 'var(--ink)' }}>
          {show.title}
        </h1>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9375rem', color: 'var(--ink-2)', marginBottom: 28 }}>
          {show.venueProfile?.name ?? t('payoutIdPage.venueTbd', 'Venue TBD')}{show.venueProfile?.city ? ` · ${show.venueProfile.city}` : ''}
        </p>
        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.6rem', letterSpacing: '-.03em', lineHeight: 1 }}>
              {formatNumber(locale, sold)}{capacity > 0 ? ` / ${formatNumber(locale, capacity)}` : ''}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9375rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3)', marginTop: 4 }}>{t('payoutIdPage.ticketsSold', 'Tickets sold')}</div>
            {/* The counter above holds seats the moment a checkout starts, so it
                can run ahead of the money. Naming the gap is the honest version
                of the figure this page used to multiply out as revenue. */}
            {heldTickets > 0 ? (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9375rem', color: 'var(--ink-3)', marginTop: 4 }}>
                {t('payoutIdPage.paidOfHeld', '{paid} paid · {held} still held')
                  .replace('{paid}', formatNumber(locale, paidTickets))
                  .replace('{held}', formatNumber(locale, heldTickets))}
              </div>
            ) : null}
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.6rem', letterSpacing: '-.03em', lineHeight: 1 }}>{fmtCents(priceCents, locale)}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9375rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3)', marginTop: 4 }}>{t('payoutIdPage.faceValue', 'Face value')}</div>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.6rem', letterSpacing: '-.03em', lineHeight: 1, color: 'var(--role-venue)' }}>$0</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9375rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3)', marginTop: 4 }}>{t('payoutIdPage.ihypeFees', 'iHYPE fees')}</div>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.6rem', letterSpacing: '-.03em', lineHeight: 1 }}>{fmtCents(collectedCents, locale)}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9375rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3)', marginTop: 4 }}>{t('payoutIdPage.collected', 'Collected')}</div>
          </div>
        </div>
      </div>

      {/* Split breakdown */}
      <div className="payout-card" style={{ background: 'var(--bg-2)', border: '1px solid var(--line, var(--hair-80))', borderRadius: 18, padding: '1.5rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--role-venue)" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', color: 'var(--ink)' }}>
            {!hasMoney
              ? t('payoutIdPage.howItWillSplit', 'How this show will split.')
              : show.status === 'ENDED'
                ? t('payoutIdPage.whereMoneyWent', 'Where the money went.')
                : t('payoutIdPage.whereMoneyGoes', 'Where the money goes.')}
          </h2>
        </div>
        <p style={{ fontSize: '0.9375rem', color: 'var(--ink-2)', lineHeight: 1.5, marginBottom: 16 }}>
          {hasMoney ? (
            <>
              {t('payoutIdPage.collectedSoFar', '{tickets} paid ticket(s) · {collected} collected.')
                .replace('{tickets}', formatNumber(locale, paidTickets))
                .replace('{collected}', fmtCents(collectedCents, locale))}{' '}
              {t('payoutIdPage.everyDollarAccounted', "Here's every dollar, accounted for.")}
            </>
          ) : (
            /* NOT "every dollar accounted for" over no dollars. A projection is
               a different claim from a statement: this projects one ticket at
               the current terms, with Stripe's fee estimated. */
            t('payoutIdPage.projectionIntro', 'Nothing has been charged yet. This is how one {price} ticket would split.')
              .replace('{price}', fmtCents(priceCents, locale))
          )}
        </p>
        <div style={{ display: 'flex', height: 10, borderRadius: 999, overflow: 'hidden', gap: 2, marginBottom: 20 }}>
          {/* The real proportions of the face value, read off the cells beneath
              it — never hardcoded. Stripe's fee is a neutral segment because it
              is nobody's share; a zero share draws nothing rather than a
              hairline claiming a payment. */}
          <div style={{ flex: artistPct, background: 'var(--accent)', borderRadius: '999px 0 0 999px' }} />
          <div style={{ flex: venuePct, background: 'var(--role-venue)' }} />
          {promoterPct > 0 ? <div style={{ flex: promoterPct, background: 'var(--ink-3)' }} /> : null}
          {feePct > 0 ? <div style={{ flex: feePct, background: 'var(--line-2)', borderRadius: '0 999px 999px 0' }} /> : null}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem' }}>
          {CELLS.map((c) => (
            <div key={c.label} style={{ padding: '1rem', borderRadius: 14, border: `1px solid ${c.color}33`, background: 'var(--bg-2)' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.6rem', letterSpacing: '-.03em', color: c.color, lineHeight: 1 }}>{fmtCents(c.cents, locale)}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9375rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3)', marginTop: 5 }}>{c.pct}% · {c.label}</div>
              <div style={{ fontSize: '0.9375rem', color: 'var(--ink-2)', marginTop: 4 }}>
                {c.href ? <Link className="mmm-standalone-link" href={c.href} style={{ color: 'inherit', textDecoration: 'none' }}>{c.name}</Link> : c.name}
              </div>
              {'note' in c && c.note ? (
                <div style={{ fontSize: '0.9375rem', color: 'var(--ink-3)', marginTop: 4, lineHeight: 1.4 }}>{c.note}</div>
              ) : null}
            </div>
          ))}
          <div style={{ padding: '1rem', borderRadius: 14, border: '1px solid rgba(var(--role-venue-rgb),.15)', background: 'rgba(var(--role-venue-rgb),.04)' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.6rem', letterSpacing: '-.03em', color: 'var(--role-venue)', lineHeight: 1 }}>$0</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9375rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3)', marginTop: 5 }}>0% · {t('payoutIdPage.platform', 'Platform')}</div>
            <div style={{ fontSize: '0.9375rem', color: 'var(--ink-2)', marginTop: 4 }}>iHYPE</div>
          </div>
        </div>
      </div>

      {/* WHAT HAS ACTUALLY MOVED. The card above explains the split; this says
          whether any of it has left iHYPE's balance yet, read off the payables
          rather than inferred from the date. Rendered only when payables exist,
          because a show with none has nothing to report and a row reading
          "$0 released" over no orders is a claim, not a figure. */}
      {releasedCents + heldPayableCents > 0 ? (
        <div className="payout-card" style={{ background: 'var(--bg-2)', border: '1px solid var(--line, var(--hair-80))', borderRadius: 18, padding: '1.25rem 1.5rem', marginBottom: '1.25rem' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9375rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 8 }}>
            {t('payoutIdPage.releaseHeading', 'Paid out so far')}
          </p>
          <p style={{ fontSize: '0.9375rem', color: 'var(--ink-2)', lineHeight: 1.6 }}>
            {t('payoutIdPage.releaseLine', '{released} transferred · {held} still held.')
              .replace('{released}', fmtCents(releasedCents, locale))
              .replace('{held}', fmtCents(heldPayableCents, locale))}
            {heldPayableCents > 0 ? (
              <>
                {' '}
                {t('payoutIdPage.releaseHold', 'Shares are released about {days} days after the show, once it has ended and each payee has a payout account connected.')
                  .replace('{days}', String(PAYOUT_HOLD_DAYS))}
              </>
            ) : null}
          </p>
          <p style={{ fontSize: '0.9375rem', color: 'var(--ink-3)', lineHeight: 1.6, marginTop: 8 }}>
            {t('payoutIdPage.releaseTax', 'Tax collected on these orders is remitted by hand and is not part of the figures above.')}
          </p>
        </div>
      ) : null}

      {show.isTicketed && priceCents > 0 && (
        <PayoutFanView priceCents={priceCents} />
      )}

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9375rem', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
          {t('payoutIdPage.ihypeTakesNothing', 'iHYPE takes nothing · locked in the charter')}
        </p>
        <div className="payout-print-actions" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Link className="mmm-standalone-link" href="/app/me/payouts?tab=history" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9375rem', color: 'var(--ink-2)' }}>
            {t('payoutIdPage.viewAllPayouts', 'View all payouts →')}
          </Link>
          <PayoutActions title={show.title} />
        </div>
      </div>

      <style>{`
        @media print {
          .payout-print-actions { display: none !important; }
          html, body { background: #fff !important; color: #111 !important; }
          .payout-card {
            border-color: #ccc !important;
            background: #fff !important;
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
}

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { MmmMissing } from '@/components/mmm/MmmMissing';
import { TicketVerificationCard } from '@/components/TicketVerificationCard';
import { TicketReassignmentForm } from '@/components/TicketReassignmentForm';
import { TicketTransferPanel } from '@/components/TicketTransferPanel';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { canManageOwnedResource } from '@/lib/permissions';
import { formatCurrencyFromCents } from '@/lib/ticketing';
import { buildTicketQrCodeDataUrl, formatTicketStatus } from '@/lib/tickets';
import { formatShowTime } from '@/lib/utils';
import { getServerT } from '@/lib/i18n/server';

export default async function TicketPage({
  params
}: {
  params: Promise<{ serializedId: string }>;
}) {
  const t = await getServerT();
  const session = await auth();
  const { serializedId } = await params;
  // The layout gates this too; every destination keeps its own check (WIRING.md).
  if (!session?.user?.id) redirect(`/login?callbackUrl=/app/me/tickets/${serializedId}`);

  const ticket = await db.ticket.findUnique({
    where: { serializedId },
    include: {
      show: {
        include: {
          venueProfile: true,
          headlinerProfile: true
        }
      },
      ticketOrder: true,
      venueProfile: true
    }
  });

  // Returned, not thrown: this route's async layout has already flushed, so a
  // thrown notFound() renders the shell twice. Same rule as every MMM pane.
  if (!ticket) return <MmmMissing body="That ticket may have been transferred or refunded — a passed-on ticket is reissued under a new code and the old one stops existing on purpose." title="No such ticket" />;

  const status = formatTicketStatus(ticket.status);
  const canScan =
    Boolean(ticket.venueProfile?.ownerId) &&
    canManageOwnedResource(session, ticket.venueProfile!.ownerId);
  /* The transfer control belongs to whoever the order is FOR, which is
     buyerUserId — the same column every ticket list is scoped by and the same
     one the transfer endpoints check. Venue staff can reach this page to scan
     and reassign; they must not be offered a control that gives the ticket
     away. The API enforces this too; this is so the button is not drawn for
     someone who would only be refused. */
  const isHolder = ticket.ticketOrder.buyerUserId === session.user.id;
  /* Holder, the venue's staff, or an admin — nobody else (second security
     scan, 2026-09-02). The id is 96 random bits, so this closes link leakage
     rather than guessing: a forwarded URL showed any signed-in member the
     holder's name, the order code and totals, and a live QR. */
  if (!isHolder && !canScan && !canManageOwnedResource(session, ticket.ticketOrder.buyerUserId ?? '')) {
    return <MmmMissing body="This ticket belongs to another account." title="Not your ticket" />;
  }
  const qrCodeDataUrl = await buildTicketQrCodeDataUrl(ticket.serializedId);

  /* ── S5 · Ticket ────────────────────────────────────────────────────────
     Translated from design/handoff-console/reference/s5-ticket.html per
     WIRING.md. Colour is tokens only; type is rem. Kept against the
     reference, per the contract: all ELEVEN stats (the reference carried six
     until this pass extended it), the REAL QR image — the reference draws a
     QR-shaped placeholder, and the design system's own TicketQR warns it must
     never render a real ticket — the class-based status pill, the venue-only
     reassignment form, and the venue/show links. Not reproduced: the 430px
     specimen frame and the dock (the shell owns both), and the reference's
     Transfer / Share-HYPE-Link buttons — nothing on this page backs them, and
     a control with no wiring is a promise the page cannot keep. */
  const stats: { label: string; value: string; accent?: boolean; mono?: boolean }[] = [
    { label: t('ticketsSerializedIdPage.holder', 'Holder'), value: ticket.holderName, mono: false },
    { label: t('ticketsSerializedIdPage.orderCode', 'Order code'), value: ticket.ticketOrder.confirmationCode },
    { label: t('ticketsSerializedIdPage.artist', 'Artist'), value: ticket.show.headlinerProfile?.name ?? t('ticketsSerializedIdPage.tba', 'TBA'), mono: false },
    { label: t('ticketsSerializedIdPage.perTicketValue', 'Per-ticket value'), value: formatCurrencyFromCents(ticket.ticketOrder.subtotalCents / ticket.ticketOrder.quantity) },
    { label: t('ticketsSerializedIdPage.orderStatus', 'Order status'), value: ticket.ticketOrder.status },
    { label: t('ticketsSerializedIdPage.scanTime', 'Scan time'), value: ticket.scannedAt ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(ticket.scannedAt) : t('ticketsSerializedIdPage.notYet', 'Not yet') },
    { label: t('ticketsSerializedIdPage.passedOn', 'Passed on'), value: ticket.reassignCount === 0 ? t('ticketsSerializedIdPage.never', 'Never') : `${ticket.reassignCount}×`, accent: ticket.reassignCount > 0 },
    { label: t('ticketsSerializedIdPage.venueZip', 'Venue ZIP'), value: ticket.show.venueProfile?.postalCode ?? t('ticketsSerializedIdPage.open', 'Open') },
    { label: t('ticketsSerializedIdPage.totalTax', 'Total tax'), value: formatCurrencyFromCents(ticket.ticketOrder.totalTaxCents) },
    /* Stripe's cut, on its own line, for the same reason the sale card states
       it before payment: without it the rail's own arithmetic does not close —
       per-ticket value plus tax does not reach the total charge, and the gap
       is unexplained money. Labelled as the ORDER's because Stripe's flat 30c
       is charged per transaction, not per ticket, so dividing it by the
       quantity would invent a per-ticket figure Stripe never charged. iHYPE's
       own fee is $0 and is not a line. */
    { label: t('ticketsSerializedIdPage.processingFee', 'Processing (Stripe, this order)'), value: formatCurrencyFromCents(ticket.ticketOrder.processingFeeCents) },
    { label: t('ticketsSerializedIdPage.totalCharge', 'Total charge'), value: formatCurrencyFromCents(ticket.ticketOrder.totalChargeCents || ticket.ticketOrder.subtotalCents) },
  ];

  return (
    <div className="mmm-show" data-surface="ticket">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 460, marginInline: 'auto' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className={`ticket-status-pill ticket-status-${ticket.status.toLowerCase()}`}>{status}</div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
            {ticket.scannedAt
              ? t('ticketsSerializedIdPage.scanned', 'Scanned')
              : t('ticketsSerializedIdPage.notYetScanned', 'Not yet scanned')}
          </span>
        </div>

        {/* The stub: the one walnut object on the page, holding the door
            credential. Everything below it is print. */}
        <div
          style={{
            background: 'var(--walnut)',
            borderRadius: 'var(--radius-panel)',
            padding: 22,
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
            boxShadow: 'inset 0 1px 0 rgba(255,220,160,.18), 0 6px 16px -6px rgba(var(--ink-1-rgb),.5)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--ink-on-walnut-3)' }}>
              {formatShowTime(ticket.show.startsAt)}
            </div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6875rem', lineHeight: 1.14, fontWeight: 500, margin: 0, color: 'var(--ink-on-walnut)' }}>
              {ticket.show.title}
            </h1>
            <div style={{ fontSize: '0.9375rem', color: 'var(--ink-on-walnut-2)' }}>
              {[ticket.show.venueProfile?.name ?? t('ticketsSerializedIdPage.venueTba', 'Venue TBA'), ticket.show.venueProfile?.city].filter(Boolean).join(' · ')}
            </div>
          </div>

          <div
            style={{
              background: 'var(--bg-base)',
              borderRadius: 'var(--radius-panel)',
              padding: 18,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 14,
              boxShadow: '0 0 0 2px var(--brass-deep), inset 0 2px 6px rgba(92,62,20,.25)',
            }}
          >
            {/* The real credential — the reference draws a QR-shaped
                placeholder here and its own component warns it must never
                render a real ticket. This image encodes the verification URL. */}
            <img
              alt={`${t('ticketsSerializedIdPage.verificationQrAlt', 'Verification QR for')} ${ticket.serializedId}`}
              src={qrCodeDataUrl}
              style={{ width: 168, height: 168, borderRadius: 2 }}
            />
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
              {t('ticketsSerializedIdPage.scanAtDoor', 'Scan at the door')}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, paddingTop: 4 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', letterSpacing: '0.16em', color: 'var(--ink-on-walnut-3)' }}>
              {t('ticketsSerializedIdPage.ticketEyebrow', 'TICKET')}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9375rem', letterSpacing: '0.06em', color: 'var(--ink-on-walnut)', overflowWrap: 'anywhere' }}>
              {ticket.serializedId}
            </span>
          </div>
        </div>

        <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius-panel)', background: 'var(--bg-surface)' }}>
          {stats.map((stat, index) => (
            <div
              key={stat.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '14px 16px',
                borderBottom: index === stats.length - 1 ? 'none' : '1px solid var(--line)',
              }}
            >
              <span style={{ flex: 1, fontSize: '0.9375rem', color: 'var(--ink-2)' }}>{stat.label}</span>
              <span
                style={{
                  fontFamily: stat.mono === false ? 'var(--font-body)' : 'var(--font-mono)',
                  fontSize: '0.9375rem',
                  fontWeight: 500,
                  color: stat.accent ? 'var(--accent-text)' : 'var(--ink)',
                  textAlign: 'right',
                }}
              >
                {stat.value}
              </span>
            </div>
          ))}
        </div>

        <p style={{ fontSize: '0.9375rem', lineHeight: 1.6, color: 'var(--ink-2)', margin: 0, textWrap: 'pretty' }}>
          {t('ticketsSerializedIdPage.serializedTokenNote', 'This ticket uses a serialized token inside iHYPE so venue staff can verify validity and block duplicate entry.')}
        </p>

        <TicketVerificationCard canScan={canScan} serializedId={ticket.serializedId} status={status} />

        {isHolder && ticket.status !== 'SCANNED' ? (
          <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius-panel)', background: 'var(--bg-surface)', padding: '16px 18px' }}>
            <h3 style={{ margin: '0 0 8px', fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 500 }}>
              {t('ticketsSerializedIdPage.transferHeading', 'Transfer this ticket')}
            </h3>
            <TicketTransferPanel orderId={ticket.ticketOrderId} />
          </div>
        ) : null}

        {canScan ? (
          <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius-panel)', background: 'var(--bg-surface)', padding: '16px 18px' }}>
            <h3 style={{ margin: '0 0 8px', fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 500 }}>
              {t('ticketsSerializedIdPage.venueReassignment', 'Venue reassignment')}
            </h3>
            {ticket.reassignCount > 0 && ticket.reassignedAt ? (
              <p style={{ fontSize: '0.9375rem', color: 'var(--ink-2)', margin: '0 0 12px' }}>
                {t('ticketsSerializedIdPage.passedOnTimesPrefix', 'This ticket has been passed on')} <strong>{ticket.reassignCount}</strong> {ticket.reassignCount !== 1 ? t('ticketsSerializedIdPage.timesPlural', 'times') : t('ticketsSerializedIdPage.timeSingular', 'time')}.
                {' '}{t('ticketsSerializedIdPage.lastReassigned', 'Last reassigned')}{' '}
                {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(ticket.reassignedAt)}.
              </p>
            ) : null}
            <TicketReassignmentForm
              faceValueCents={Math.round(ticket.ticketOrder.subtotalCents / ticket.ticketOrder.quantity)}
              serializedId={ticket.serializedId}
            />
          </div>
        ) : null}

        <div style={{ display: 'flex', gap: 10 }}>
          {ticket.show.venueProfile ? (
            <Link
              href={`/app/venues/${ticket.show.venueProfile.slug}`}
              style={{ flex: 1, minHeight: 46, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--line-2)', borderRadius: 'var(--radius-pill)', color: 'var(--ink-1)', fontSize: '0.9375rem', fontWeight: 500, textDecoration: 'none' }}
            >
              {t('ticketsSerializedIdPage.openVenue', 'Open venue')}
            </Link>
          ) : null}
          <Link
            href={`/app/shows/${ticket.show.slug}`}
            style={{ flex: 1, minHeight: 46, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--line-2)', borderRadius: 'var(--radius-pill)', color: 'var(--ink-1)', fontSize: '0.9375rem', fontWeight: 500, textDecoration: 'none' }}
          >
            {t('ticketsSerializedIdPage.openShow', 'Open show')}
          </Link>
        </div>

      </div>
    </div>
  );
}

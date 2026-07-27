import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TicketVerificationCard } from '@/components/TicketVerificationCard';
import { TicketReassignmentForm } from '@/components/TicketReassignmentForm';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { canManageOwnedResource } from '@/lib/permissions';
import { formatCurrencyFromCents } from '@/lib/ticketing';
import { buildTicketQrCodeDataUrl, formatTicketStatus } from '@/lib/tickets';
import { formatShowTime } from '@/lib/utils';
import { getLocale, getT } from '@/lib/i18n/server';

export default async function TicketPage({
  params
}: {
  params: Promise<{ serializedId: string }>;
}) {
  const t = getT(await getLocale());
  const session = await auth();
  const { serializedId } = await params;

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

  if (!ticket) return notFound();

  const status = formatTicketStatus(ticket.status);
  const canScan =
    Boolean(ticket.venueProfile?.ownerId) &&
    canManageOwnedResource(session, ticket.venueProfile!.ownerId);
  const qrCodeDataUrl = await buildTicketQrCodeDataUrl(ticket.serializedId);

  return (
    <div className="container section">
      <section className="panel ticket-verification-panel">
        <div className="ticket-verification-header">
          <div>
            <div className="badge">{t('ticketsSerializedIdPage.badge', 'Ticket verification')}</div>
            <h1>{ticket.show.title}</h1>
            <p className="subtitle">
              {ticket.show.venueProfile?.name ?? t('ticketsSerializedIdPage.venueTba', 'Venue TBA')} | {formatShowTime(ticket.show.startsAt)}
            </p>
          </div>
          <div className={`ticket-status-pill ticket-status-${ticket.status.toLowerCase()}`}>{status}</div>
        </div>

        <div className="ticket-verification-grid">
          <div className="ticket-verification-qr">
            <img alt={`${t('ticketsSerializedIdPage.verificationQrAlt', 'Verification QR for')} ${ticket.serializedId}`} src={qrCodeDataUrl} />
            <div className="meta">{ticket.serializedId}</div>
          </div>

          <div className="ticket-verification-copy">
            <div className="grid grid-2">
              <div className="stat">
                <strong>{ticket.holderName}</strong>
                {t('ticketsSerializedIdPage.holder', 'Holder')}
              </div>
              <div className="stat">
                <strong>{ticket.ticketOrder.confirmationCode}</strong>
                {t('ticketsSerializedIdPage.orderCode', 'Order code')}
              </div>
              <div className="stat">
                <strong>{ticket.show.headlinerProfile?.name ?? t('ticketsSerializedIdPage.tba', 'TBA')}</strong>
                {t('ticketsSerializedIdPage.artist', 'Artist')}
              </div>
              <div className="stat">
                <strong>{formatCurrencyFromCents(ticket.ticketOrder.subtotalCents / ticket.ticketOrder.quantity)}</strong>
                {t('ticketsSerializedIdPage.perTicketValue', 'Per-ticket value')}
              </div>
              <div className="stat">
                <strong>{ticket.ticketOrder.status}</strong>
                {t('ticketsSerializedIdPage.orderStatus', 'Order status')}
              </div>
              <div className="stat">
                <strong>{ticket.scannedAt ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(ticket.scannedAt) : t('ticketsSerializedIdPage.notYet', 'Not yet')}</strong>
                {t('ticketsSerializedIdPage.scanTime', 'Scan time')}
              </div>
              <div className="stat">
                <strong style={ticket.reassignCount > 0 ? { color: 'var(--accent-3)' } : {}}>
                  {ticket.reassignCount === 0 ? t('ticketsSerializedIdPage.never', 'Never') : `${ticket.reassignCount}×`}
                </strong>
                {t('ticketsSerializedIdPage.passedOn', 'Passed on')}
              </div>
              <div className="stat">
                <strong>{ticket.show.venueProfile?.postalCode ?? t('ticketsSerializedIdPage.open', 'Open')}</strong>
                {t('ticketsSerializedIdPage.venueZip', 'Venue ZIP')}
              </div>
              <div className="stat">
                <strong>{formatCurrencyFromCents(ticket.ticketOrder.totalTaxCents)}</strong>
                {t('ticketsSerializedIdPage.totalTax', 'Total tax')}
              </div>
              <div className="stat">
                <strong>{formatCurrencyFromCents(ticket.ticketOrder.totalChargeCents || ticket.ticketOrder.subtotalCents)}</strong>
                {t('ticketsSerializedIdPage.totalCharge', 'Total charge')}
              </div>
            </div>

            <p className="meta">
              {t('ticketsSerializedIdPage.serializedTokenNote', 'This ticket uses a serialized token inside iHYPE so venue staff can verify validity and block duplicate entry.')}
            </p>

            <TicketVerificationCard canScan={canScan} serializedId={ticket.serializedId} status={status} />

            {canScan ? (
              <div className="request-history">
                <h3>{t('ticketsSerializedIdPage.venueReassignment', 'Venue reassignment')}</h3>
                {ticket.reassignCount > 0 && ticket.reassignedAt ? (
                  <p className="meta" style={{ marginBottom: '0.75rem' }}>
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

            <div className="cta-row">
              {ticket.show.venueProfile ? (
                <Link className="button small secondary" href={`/venues/${ticket.show.venueProfile.slug}`}>
                  {t('ticketsSerializedIdPage.openVenue', 'Open venue')}
                </Link>
              ) : null}
              <Link className="button small secondary" href={`/shows/${ticket.show.slug}`}>
                {t('ticketsSerializedIdPage.openShow', 'Open show')}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

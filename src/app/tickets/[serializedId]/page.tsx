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

export default async function TicketPage({
  params
}: {
  params: Promise<{ serializedId: string }>;
}) {
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
    <main className="container section">
      <section className="panel ticket-verification-panel">
        <div className="ticket-verification-header">
          <div>
            <div className="badge">Ticket verification</div>
            <h1>{ticket.show.title}</h1>
            <p className="subtitle">
              {ticket.show.venueProfile?.name ?? 'Venue TBA'} | {formatShowTime(ticket.show.startsAt)}
            </p>
          </div>
          <div className={`ticket-status-pill ticket-status-${ticket.status.toLowerCase()}`}>{status}</div>
        </div>

        <div className="ticket-verification-grid">
          <div className="ticket-verification-qr">
            <img alt={`Verification QR for ${ticket.serializedId}`} src={qrCodeDataUrl} />
            <div className="meta">{ticket.serializedId}</div>
          </div>

          <div className="ticket-verification-copy">
            <div className="grid grid-2">
              <div className="stat">
                <strong>{ticket.holderName}</strong>
                Holder
              </div>
              <div className="stat">
                <strong>{ticket.ticketOrder.confirmationCode}</strong>
                Order code
              </div>
              <div className="stat">
                <strong>{ticket.show.headlinerProfile?.name ?? 'TBA'}</strong>
                Artist
              </div>
              <div className="stat">
                <strong>{formatCurrencyFromCents(ticket.ticketOrder.subtotalCents / ticket.ticketOrder.quantity)}</strong>
                Per-ticket value
              </div>
              <div className="stat">
                <strong>{ticket.ticketOrder.status}</strong>
                Order status
              </div>
              <div className="stat">
                <strong>{ticket.scannedAt ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(ticket.scannedAt) : 'Not yet'}</strong>
                Scan time
              </div>
              <div className="stat">
                <strong>{ticket.show.venueProfile?.postalCode ?? 'Open'}</strong>
                Venue ZIP
              </div>
              <div className="stat">
                <strong>{formatCurrencyFromCents(ticket.ticketOrder.totalTaxCents)}</strong>
                Total tax
              </div>
              <div className="stat">
                <strong>{formatCurrencyFromCents(ticket.ticketOrder.totalChargeCents || ticket.ticketOrder.subtotalCents)}</strong>
                Total charge
              </div>
            </div>

            <p className="meta">
              This ticket uses a serialized token inside iHYPE so venue staff can verify validity and block duplicate entry.
            </p>

            <TicketVerificationCard canScan={canScan} serializedId={ticket.serializedId} status={status} />

            {canScan ? (
              <div className="request-history">
                <h3>Venue reassignment</h3>
                <TicketReassignmentForm
                  faceValueCents={Math.round(ticket.ticketOrder.subtotalCents / ticket.ticketOrder.quantity)}
                  serializedId={ticket.serializedId}
                />
              </div>
            ) : null}

            <div className="cta-row">
              {ticket.show.venueProfile ? (
                <Link className="button small secondary" href={`/venues/${ticket.show.venueProfile.slug}`}>
                  Open venue
                </Link>
              ) : null}
              <Link className="button small secondary" href={`/shows/${ticket.show.slug}`}>
                Open show
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

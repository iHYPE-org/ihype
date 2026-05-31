import Link from 'next/link';
import { TicketSaleCard } from '@/components/TicketSaleCard';
import { formatCurrencyFromCents } from '@/lib/ticketing';
import { formatShowTime } from '@/lib/utils';

interface TicketOrder {
  id: string;
  status: string;
  totalTaxCents: number;
  confirmationCode: string;
  buyerName: string;
  quantity: number;
  totalChargeCents: number;
  subtotalCents: number;
  venuePayoutCents: number;
  artistPayoutCents: number;
  promoterPayoutCents: number;
  tickets: { reassignCount: number }[];
}

interface CurrentFan {
  name: string | null;
  email: string | null;
  role: string;
  storedPaymentTokenRef: string | null;
  storedPaymentTokenBrand: string | null;
  storedPaymentTokenLast4: string | null;
}

interface ShowTicketingProps {
  show: {
    id: string;
    title: string;
    status: string;
    isTicketed: boolean;
    ticketPriceCents: number;
    ticketsSoldCount: number;
    ticketCapacity: number | null;
    ticketingOpensAt: Date | null;
    venuePayoutPercent: number | null;
    artistPayoutPercent: number | null;
    promoterPayoutPercent: number;
    venueProfile: {
      name: string;
      postalCode: string | null;
      stateRegion: string | null;
      country: string | null;
    } | null;
    headlinerProfile: { name: string } | null;
    promoterProfile: { name: string } | null;
    ticketOrders: TicketOrder[];
  };
  currentFan: CurrentFan | null;
  affiliatePromoter: { id: string; name: string } | null;
  viewerLocation: { city?: string | null; stateRegion?: string | null; country?: string | null; postalCode?: string | null; [key: string]: unknown } | null;
}

export function ShowTicketing({ show, currentFan, affiliatePromoter, viewerLocation }: ShowTicketingProps) {
  const showTicketSaleCard =
    show.isTicketed &&
    show.venueProfile &&
    show.headlinerProfile &&
    show.venuePayoutPercent !== null &&
    show.artistPayoutPercent !== null;

  return (
    <>
      {showTicketSaleCard && show.venueProfile && show.headlinerProfile && show.venuePayoutPercent !== null && show.artistPayoutPercent !== null ? (
        <section className="section">
          <TicketSaleCard
            affiliatePromoterName={affiliatePromoter?.name ?? null}
            affiliatePromoterProfileId={affiliatePromoter?.id ?? null}
            artistName={show.headlinerProfile.name}
            artistPayoutPercent={show.artistPayoutPercent}
            currentFan={
              currentFan?.role === 'FAN'
                ? {
                    name: currentFan.name,
                    email: currentFan.email ?? '',
                    hasStoredPaymentToken: Boolean(currentFan.storedPaymentTokenRef),
                    storedPaymentTokenBrand: currentFan.storedPaymentTokenBrand,
                    storedPaymentTokenLast4: currentFan.storedPaymentTokenLast4
                  }
                : null
            }
            promoterName={show.promoterProfile?.name ?? null}
            promoterPayoutPercent={show.promoterPayoutPercent}
            showId={show.id}
            ticketCapacity={show.ticketCapacity}
            ticketPriceCents={show.ticketPriceCents}
            ticketingOpen={show.status === 'LIVE' || Boolean(show.ticketingOpensAt && show.ticketingOpensAt <= new Date())}
            ticketingOpensAtLabel={show.ticketingOpensAt ? formatShowTime(show.ticketingOpensAt) : null}
            ticketsSoldCount={show.ticketsSoldCount}
            title={show.title}
            venueName={show.venueProfile.name}
            venueLocation={{
              postalCode: show.venueProfile.postalCode,
              stateRegion: show.venueProfile.stateRegion,
              country: show.venueProfile.country
            }}
            venuePayoutPercent={show.venuePayoutPercent}
            viewerLocation={{
              city: viewerLocation?.city,
              stateRegion: viewerLocation?.stateRegion,
              country: viewerLocation?.country,
              postalCode: viewerLocation?.postalCode
            }}
          />
        </section>
      ) : null}

      {show.ticketOrders.length ? (
        <section className="section">
          <div className="panel" style={{ padding: '1.25rem' }}>
            <h2>Recent ticket orders</h2>
            <table className="table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Tax</th>
                  <th>Code</th>
                  <th>Buyer</th>
                  <th>Qty</th>
                  <th>Total</th>
                  <th>Venue</th>
                  <th>Artist</th>
                  <th>Promoter</th>
                  <th title="Total reassignments across all tickets in this order">Passed</th>
                </tr>
              </thead>
              <tbody>
                {show.ticketOrders.map((order) => {
                  const totalPassed = order.tickets.reduce((sum, t) => sum + t.reassignCount, 0);
                  return (
                    <tr key={order.id}>
                      <td>{order.status}</td>
                      <td>{formatCurrencyFromCents(order.totalTaxCents)}</td>
                      <td>{order.confirmationCode}</td>
                      <td>{order.buyerName}</td>
                      <td>{order.quantity}</td>
                      <td>{formatCurrencyFromCents(order.totalChargeCents || order.subtotalCents)}</td>
                      <td>{formatCurrencyFromCents(order.venuePayoutCents)}</td>
                      <td>{formatCurrencyFromCents(order.artistPayoutCents)}</td>
                      <td>{formatCurrencyFromCents(order.promoterPayoutCents)}</td>
                      <td style={totalPassed > 0 ? { color: 'var(--accent-3)', fontWeight: 600 } : { color: 'var(--muted)' }}>
                        {totalPassed > 0 ? `${totalPassed}×` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {show.isTicketed && show.ticketOrders.length > 0 && (
        <section className="section">
          <div className="panel" style={{ padding: '1.25rem' }}>
            <h2>Transfer your ticket</h2>
            <p className="subtitle" style={{ marginBottom: '1rem' }}>Can&apos;t make it? You can transfer your ticket to a friend — no fees, just update the holder name.</p>
            <p className="meta">Find your ticket confirmation email and visit the ticket link to reassign it, or go to <Link href="/home">your dashboard</Link> to manage your orders.</p>
          </div>
        </section>
      )}
    </>
  );
}

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import type { Metadata } from 'next';
import { TicketCardActions } from '@/components/TicketCardActions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'My Tickets · iHYPE',
  robots: { index: false, follow: false },
};

function fmtCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function MyTicketsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?callbackUrl=/me/tickets');

  const now = new Date();

  const orders = await db.ticketOrder.findMany({
    where: { buyerUserId: session.user.id, status: { not: 'VOID' }, show: { startsAt: { gte: now } } },
    orderBy: { show: { startsAt: 'asc' } },
    take: 50,
    select: {
      id: true,
      confirmationCode: true,
      quantity: true,
      status: true,
      subtotalCents: true,
      totalChargeCents: true,
      show: {
        select: {
          slug: true,
          title: true,
          startsAt: true,
        },
      },
      tickets: {
        select: { id: true, serializedId: true },
      },
    },
  });

  return (
    <div className="tickets-container">
      <div className="tickets-header">
        <h1>My Tickets</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-a70)' }}>Your upcoming shows</p>
      </div>

      {orders.length === 0 ? (
        <div className="ihype-empty-state">
          <div className="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 9a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v1a1 1 0 0 0 0 2v1a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-1a1 1 0 0 1 0-2V9Z" /><line x1="10" y1="7" x2="10" y2="17" /></svg></div>
          <h3>No tickets yet</h3>
          <p>Browse upcoming shows and grab your first ticket.</p>
          <Link className="ihype-btn-primary" href="/shows" style={{ display: 'inline-block', textDecoration: 'none' }}>
            Browse shows →
          </Link>
        </div>
      ) : (
        <div className="ticket-list">
          {orders.map((order) => {
            const show = order.show;
            const dateStr = new Date(show.startsAt).toLocaleDateString('en-US', {
              weekday: 'long', month: 'long', day: 'numeric',
            });
            const timeStr = new Date(show.startsAt).toLocaleTimeString('en-US', {
              hour: 'numeric', minute: '2-digit',
            });
            const unitPriceCents = order.quantity > 0
              ? Math.round((order.totalChargeCents || order.subtotalCents) / order.quantity)
              : (order.totalChargeCents || order.subtotalCents);

            return (
              <div className="ticket-card" key={order.id}>
                <div className="ticket-header">
                  <div className="ticket-title">
                    <Link href={`/shows/${show.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                      <h3>{show.title}</h3>
                    </Link>
                    <p className="ticket-meta">{dateStr} · {timeStr}</p>
                  </div>
                  <span className="ticket-status">Valid</span>
                </div>

                <div className="ticket-details">
                  <div className="detail-item">
                    <div className="detail-label">Ticket #</div>
                    <div className="detail-value">{order.tickets[0]?.serializedId ?? order.confirmationCode}</div>
                  </div>
                  <div className="detail-item">
                    <div className="detail-label">Price</div>
                    <div className="detail-value">{fmtCents(unitPriceCents)}</div>
                  </div>
                  <div className="detail-item">
                    <div className="detail-label">Seat</div>
                    <div className="detail-value">GA</div>
                  </div>
                </div>

                <TicketCardActions orderId={order.id} tickets={order.tickets} />
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        .tickets-container { max-width: 900px; margin: 0 auto; padding: 40px 24px; }
        .tickets-header { margin-bottom: 40px; }
        .tickets-header h1 { font-family: var(--font-display); font-size: 32px; font-weight: 800; letter-spacing: -0.02em; margin-bottom: 8px; color: var(--ink); }
        .ticket-list { display: grid; gap: 24px; }
        .ticket-card { border: 1px solid var(--line); border-radius: 12px; padding: 24px; background: linear-gradient(135deg, var(--bg2), var(--bg3)); }
        .ticket-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
        .ticket-title h3 { font-family: var(--font-display); font-size: 18px; font-weight: 800; margin-bottom: 4px; color: var(--ink); }
        .ticket-meta { font-size: 13px; color: var(--ink-a70); }
        .ticket-status { display: inline-block; padding: 4px 8px; background: rgba(34, 229, 212, 0.15); color: var(--role-venue, #22e5d4); font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: 0.14em; border-radius: 3px; }
        .ticket-details { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; padding-top: 16px; border-top: 1px solid var(--line); margin-bottom: 16px; }
        @media (max-width: 480px) { .ticket-details { grid-template-columns: 1fr 1fr; } }
        .detail-label { font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: 0.14em; color: var(--ink-a60); margin-bottom: 4px; }
        .detail-value { font-size: 14px; font-weight: 600; color: var(--ink); }
        .ticket-actions { display: flex; gap: 12px; flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; -webkit-overflow-scrolling: touch; }
        .ticket-actions::-webkit-scrollbar { display: none; }
        .ticket-actions > * { flex-shrink: 0; white-space: nowrap; }
        .btn { padding: 10px 16px; border: 1px solid var(--line); background: transparent; color: var(--ink); border-radius: 6px; cursor: pointer; font-size: 13px; transition: all 150ms; }
        .btn:hover { background: var(--hair-50); }
        .btn-primary { background: var(--accent); color: #fff; border-color: var(--accent); }
      `}</style>
    </div>
  );
}

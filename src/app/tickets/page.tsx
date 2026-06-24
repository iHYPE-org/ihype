import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'My Tickets · iHYPE',
  robots: { index: false, follow: false },
};

const STATUS_LABEL: Record<string, string> = {
  RESERVED: 'Reserved',
  PAID: 'Confirmed',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
};

const STATUS_COLOR: Record<string, string> = {
  RESERVED: '#ffb84a',
  PAID: '#22e5d4',
  CANCELLED: 'rgba(240,235,229,.3)',
  REFUNDED: 'rgba(240,235,229,.3)',
};

function fmtCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function MyTicketsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?callbackUrl=/me/tickets');

  const orders = await db.ticketOrder.findMany({
    where: { buyerUserId: session.user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      confirmationCode: true,
      quantity: true,
      status: true,
      subtotalCents: true,
      totalChargeCents: true,
      createdAt: true,
      show: {
        select: {
          slug: true,
          title: true,
          startsAt: true,
          status: true,
          venueProfile: { select: { name: true, city: true } },
          headlinerProfile: { select: { name: true } },
        },
      },
      tickets: {
        select: { id: true, serializedId: true },
      },
    },
  });

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 24px 100px' }}>

      <div style={{ marginBottom: 32 }}>
        <Link href="/home" style={{ fontSize: 12, color: 'rgba(240,235,229,.4)', textDecoration: 'none', fontFamily: 'var(--font-mono)', letterSpacing: '.06em' }}>
          ← HOME
        </Link>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.6rem, 4vw, 2.2rem)', fontWeight: 800, letterSpacing: '-.03em', margin: '12px 0 0' }}>
          My Tickets
        </h1>
      </div>

      {orders.length === 0 ? (
        <div className="ihype-empty-state">
          <div className="icon">🎟️</div>
          <h3>No tickets yet</h3>
          <p>Browse upcoming shows and grab your first ticket.</p>
          <Link href="/shows" className="ihype-btn-primary" style={{ display: 'inline-block', textDecoration: 'none' }}>
            Browse shows →
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {orders.map(order => {
            const show = order.show;
            const date = new Date(show.startsAt).toLocaleDateString('en-US', {
              weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
            });
            const isPast = new Date(show.startsAt) < new Date();
            const statusColor = STATUS_COLOR[order.status] ?? 'rgba(240,235,229,.3)';

            return (
              <div key={order.id} className="ihype-card" style={{ padding: '20px 22px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <Link href={`/shows/${show.slug}`} style={{ textDecoration: 'none' }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, color: 'var(--ink)', marginBottom: 3 }}>
                        {show.title}
                      </div>
                    </Link>
                    <div style={{ fontSize: 12, color: 'rgba(240,235,229,.45)' }}>
                      {show.headlinerProfile?.name ?? 'iHYPE Radio'}
                      {show.venueProfile?.city ? ` · ${show.venueProfile.city}` : ''}
                    </div>
                  </div>
                  <span style={{
                    padding: '3px 10px', borderRadius: 9999,
                    fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '.06em',
                    background: `${statusColor}22`,
                    color: statusColor,
                    border: `1px solid ${statusColor}44`,
                    whiteSpace: 'nowrap', marginLeft: 12,
                  }}>
                    {STATUS_LABEL[order.status] ?? order.status}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 24, marginBottom: 14, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(240,235,229,.35)', marginBottom: 2 }}>Date</div>
                    <div style={{ fontSize: 13, color: isPast ? 'rgba(240,235,229,.4)' : 'var(--ink)' }}>{date}</div>
                  </div>
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(240,235,229,.35)', marginBottom: 2 }}>Qty</div>
                    <div style={{ fontSize: 13, color: 'var(--ink)' }}>{order.quantity}</div>
                  </div>
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(240,235,229,.35)', marginBottom: 2 }}>Total</div>
                    <div style={{ fontSize: 13, color: 'var(--ink)' }}>{fmtCents(order.totalChargeCents || order.subtotalCents)}</div>
                  </div>
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(240,235,229,.35)', marginBottom: 2 }}>Confirmation</div>
                    <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'rgba(240,235,229,.6)', letterSpacing: '.04em' }}>{order.confirmationCode}</div>
                  </div>
                </div>

                {order.tickets.length > 0 && (
                  <div style={{ borderTop: '1px solid rgba(255,255,255,.06)', paddingTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {order.tickets.map(t => (
                      <span key={t.id} style={{
                        padding: '4px 10px', border: '1px solid rgba(255,255,255,.08)',
                        borderRadius: 6, fontSize: 11, fontFamily: 'var(--font-mono)',
                        color: 'rgba(240,235,229,.45)', letterSpacing: '.04em',
                      }}>
                        {t.serializedId}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

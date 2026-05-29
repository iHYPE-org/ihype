import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { isAdminSession } from '@/lib/permissions';
import { WORKBENCH_PATH } from '@/lib/auth-redirects';
import { db } from '@/lib/db';
import Link from 'next/link';

export const metadata = {
  title: 'Finance | Admin | iHYPE',
  robots: { index: false, follow: false },
};

export default async function AdminFinancePage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  if (!isAdminSession(session)) redirect(WORKBENCH_PATH);

  const { tab } = searchParams ? await searchParams : {};
  const activeTab = tab ?? 'revenue';

  const since12m = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

  const [monthlyOrders, payoutEntries, recentPromos, revenueAgg] = await Promise.all([
    db.ticketOrder.findMany({
      where: { status: 'CAPTURED', chargedAt: { gte: since12m } },
      select: { chargedAt: true, totalChargeCents: true },
    }).catch(() => [] as { chargedAt: Date | null; totalChargeCents: number }[]),
    db.accountsPayableEntry.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { profile: { select: { name: true, slug: true } } },
    }).catch(() => []),
    db.promoCode.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
    }).catch(() => []),
    db.ticketOrder.aggregate({
      where: { status: 'CAPTURED' },
      _sum: { totalChargeCents: true },
    }).catch(() => ({ _sum: { totalChargeCents: null } })),
  ]);

  // Monthly revenue map
  const monthlyMap: Record<string, number> = {};
  for (const order of monthlyOrders) {
    if (!order.chargedAt) continue;
    const key = `${order.chargedAt.getFullYear()}-${String(order.chargedAt.getMonth() + 1).padStart(2, '0')}`;
    monthlyMap[key] = (monthlyMap[key] ?? 0) + order.totalChargeCents;
  }
  const monthlyRows = Object.entries(monthlyMap).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12);

  const revenueCents = revenueAgg._sum.totalChargeCents ?? 0;
  const platformFee = Math.round(revenueCents * 0.1);
  const payoutPaid = payoutEntries.filter(e => e.status === 'RELEASED').reduce((s, e) => s + e.amountCents, 0);
  const payoutPending = payoutEntries.filter(e => e.status === 'PENDING').reduce((s, e) => s + e.amountCents, 0);

  const TABS = [
    { key: 'revenue', label: 'Revenue' },
    { key: 'payouts', label: 'Payouts' },
    { key: 'tickets', label: 'Tickets' },
    { key: 'promo-codes', label: 'Promo Codes' },
  ];

  return (
    <main className="container section admin-console">
      <section className="panel admin-console-panel">
        <h1 style={{ fontSize: 20, marginBottom: 16 }}>Finance</h1>
        <div className="admin-export-row" style={{ marginBottom: 20 }}>
          {TABS.map(t => (
            <Link
              key={t.key}
              href={`/admin/finance?tab=${t.key}`}
              className={`button small ${activeTab === t.key ? '' : 'secondary'}`}
            >
              {t.label}
            </Link>
          ))}
        </div>

        {activeTab === 'revenue' && (
          <>
            <div className="admin-metric-grid" style={{ marginBottom: 20 }}>
              {[
                ['Total revenue (CAPTURED)', `$${(revenueCents / 100).toFixed(2)}`],
                ['Platform fee est. (10%)', `$${(platformFee / 100).toFixed(2)}`],
                ['Payouts paid', `$${(payoutPaid / 100).toFixed(2)}`],
                ['Payouts pending', `$${(payoutPending / 100).toFixed(2)}`],
              ].map(([label, value]) => (
                <article className="card admin-metric-card" key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </article>
              ))}
            </div>
            <h3 style={{ fontSize: 14, marginBottom: 8 }}>Monthly revenue (last 12 months)</h3>
            {monthlyRows.length === 0 ? (
              <div className="empty">No captured orders yet.</div>
            ) : (
              <div className="admin-list">
                {monthlyRows.map(([month, cents]) => (
                  <div className="admin-list-row" key={month}>
                    <span>{month}</span>
                    <strong>${(cents / 100).toFixed(2)}</strong>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'payouts' && (
          <>
            <h3 style={{ fontSize: 14, marginBottom: 8 }}>Accounts Payable</h3>
            {payoutEntries.length === 0 ? (
              <div className="empty">No payout entries yet.</div>
            ) : (
              <div className="admin-list">
                {payoutEntries.map(e => (
                  <div className="admin-list-row" key={e.id}>
                    <span>{e.profile?.name ?? e.profileId ?? 'unknown'}</span>
                    <strong>{e.status}</strong>
                    <small>${(e.amountCents / 100).toFixed(2)}</small>
                    <small>{e.createdAt.toISOString().slice(0, 10)}</small>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'tickets' && (
          <>
            <h3 style={{ fontSize: 14, marginBottom: 8 }}>Recent Ticket Orders</h3>
            <Link href="/admin" className="button small secondary" style={{ marginBottom: 12, display: 'inline-block' }}>
              View all on Overview
            </Link>
            <p className="meta">Detailed ticket order list is available on the Overview page.</p>
          </>
        )}

        {activeTab === 'promo-codes' && (
          <>
            <h3 style={{ fontSize: 14, marginBottom: 8 }}>Promo Codes</h3>
            {recentPromos.length === 0 ? (
              <div className="empty">No promo codes yet.</div>
            ) : (
              <div className="admin-list">
                {recentPromos.map(p => (
                  <div className="admin-list-row" key={p.id}>
                    <code style={{ fontFamily: 'monospace' }}>{p.code}</code>
                    <strong>{p.discountType}</strong>
                    <small>{p.discountValue}% off</small>
                    <small>{p.useCount}/{p.maxUses ?? '∞'} uses</small>
                    <small style={{ color: p.expiresAt && p.expiresAt < new Date() ? 'var(--ink3,#666)' : 'var(--teal,#22e5d4)' }}>
                      {p.expiresAt && p.expiresAt < new Date() ? 'EXPIRED' : 'ACTIVE'}
                    </small>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}

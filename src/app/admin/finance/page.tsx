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

const PAGE_SIZE = 50;

export default async function AdminFinancePage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string; from?: string; to?: string; promoStatus?: string; payoutStatus?: string; ticketStatus?: string; page?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  if (!isAdminSession(session)) redirect(WORKBENCH_PATH);

  const sp = searchParams ? await searchParams : {};
  const activeTab = sp.tab ?? 'revenue';
  const page = Math.max(1, parseInt(sp.page ?? '1', 10));

  // Custom date range — default to last 12 months
  const defaultFrom = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  const fromDate = sp.from ? new Date(sp.from) : defaultFrom;
  const toDate = sp.to ? new Date(sp.to) : new Date();

  const promoStatus = sp.promoStatus ?? '';
  const payoutStatus = sp.payoutStatus ?? '';
  const ticketStatus = sp.ticketStatus ?? '';

  const payoutWhere: Record<string, unknown> = {};
  if (payoutStatus) payoutWhere.status = payoutStatus;

  const promoWhere: Record<string, unknown> = {};
  if (promoStatus === 'active') promoWhere.OR = [{ expiresAt: null }, { expiresAt: { gt: new Date() } }];
  if (promoStatus === 'expired') promoWhere.expiresAt = { lte: new Date() };

  const ticketWhere: Record<string, unknown> = {};
  if (ticketStatus) ticketWhere.status = ticketStatus;

  const [monthlyOrders, payoutEntries, payoutTotal, recentPromos, promoTotal, revenueAgg, ticketOrders, ticketOrderTotal] = await Promise.all([
    db.ticketOrder.findMany({
      where: { status: 'CAPTURED', chargedAt: { gte: fromDate, lte: toDate } },
      select: { chargedAt: true, totalChargeCents: true },
    }).catch(() => [] as { chargedAt: Date | null; totalChargeCents: number }[]),
    db.accountsPayableEntry.findMany({
      where: payoutWhere,
      orderBy: { createdAt: 'desc' },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      include: { profile: { select: { name: true, slug: true } } },
    }).catch(() => []),
    db.accountsPayableEntry.count({ where: payoutWhere }).catch(() => 0),
    db.promoCode.findMany({
      where: promoWhere,
      orderBy: { createdAt: 'desc' },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }).catch(() => []),
    db.promoCode.count({ where: promoWhere }).catch(() => 0),
    db.ticketOrder.aggregate({
      where: { status: 'CAPTURED', chargedAt: { gte: fromDate, lte: toDate } },
      _sum: { totalChargeCents: true },
    }).catch(() => ({ _sum: { totalChargeCents: null } })),
    db.ticketOrder.findMany({
      where: ticketWhere,
      orderBy: { createdAt: 'desc' },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      select: {
        id: true, confirmationCode: true, buyerName: true, buyerEmail: true, quantity: true,
        status: true, totalChargeCents: true, createdAt: true, chargedAt: true,
        show: { select: { title: true, slug: true } },
      },
    }).catch(() => []),
    db.ticketOrder.count({ where: ticketWhere }).catch(() => 0),
  ]);

  const monthlyMap: Record<string, number> = {};
  for (const order of monthlyOrders) {
    if (!order.chargedAt) continue;
    const key = `${order.chargedAt.getFullYear()}-${String(order.chargedAt.getMonth() + 1).padStart(2, '0')}`;
    monthlyMap[key] = (monthlyMap[key] ?? 0) + order.totalChargeCents;
  }
  const monthlyRows = Object.entries(monthlyMap).sort((a, b) => b[0].localeCompare(a[0]));

  const revenueCents = revenueAgg._sum.totalChargeCents ?? 0;
  const platformFee = Math.round(revenueCents * 0.1);
  const payoutPaid = payoutEntries.filter(e => e.status === 'RELEASED').reduce((s, e) => s + e.amountCents, 0);
  const payoutPending = payoutEntries.filter(e => e.status === 'PENDING').reduce((s, e) => s + e.amountCents, 0);

  const payoutPages = Math.ceil(payoutTotal / PAGE_SIZE);
  const promoPages = Math.ceil(promoTotal / PAGE_SIZE);
  const ticketPages = Math.ceil(ticketOrderTotal / PAGE_SIZE);

  const tabHref = (t: string) => `/admin/finance?tab=${t}`;
  const pageHref = (p: number) => {
    const params = new URLSearchParams({ tab: activeTab, ...(sp.from ? { from: sp.from } : {}), ...(sp.to ? { to: sp.to } : {}), ...(promoStatus ? { promoStatus } : {}), ...(payoutStatus ? { payoutStatus } : {}), ...(ticketStatus ? { ticketStatus } : {}), page: String(p) });
    return `/admin/finance?${params}`;
  };

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
            <Link key={t.key} href={tabHref(t.key)} className={`button small ${activeTab === t.key ? '' : 'secondary'}`}>{t.label}</Link>
          ))}
        </div>

        {/* Date range filter — shown on revenue tab */}
        {activeTab === 'revenue' && (
          <>
            <form method="get" style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <input type="hidden" name="tab" value="revenue" />
              <label style={{ display: 'grid', gap: 4 }}>
                <span className="meta">From</span>
                <input className="input" type="date" name="from" defaultValue={sp.from ?? defaultFrom.toISOString().slice(0, 10)} />
              </label>
              <label style={{ display: 'grid', gap: 4 }}>
                <span className="meta">To</span>
                <input className="input" type="date" name="to" defaultValue={sp.to ?? new Date().toISOString().slice(0, 10)} />
              </label>
              <button className="button small" type="submit" style={{ alignSelf: 'flex-end' }}>Apply</button>
            </form>
            <div className="admin-metric-grid" style={{ marginBottom: 20 }}>
              {[
                ['Total revenue (CAPTURED)', `$${(revenueCents / 100).toFixed(2)}`],
                ['Platform fee est. (10%)', `$${(platformFee / 100).toFixed(2)}`],
                ['Payouts paid', `$${(payoutPaid / 100).toFixed(2)}`],
                ['Payouts pending', `$${(payoutPending / 100).toFixed(2)}`],
              ].map(([label, value]) => (
                <article className="card admin-metric-card" key={label}><span>{label}</span><strong>{value}</strong></article>
              ))}
            </div>
            <h3 style={{ fontSize: 14, marginBottom: 8 }}>Monthly revenue ({monthlyRows.length} months in range)</h3>
            {monthlyRows.length === 0 ? (
              <div className="empty">No captured orders in this range.</div>
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
            <form method="get" style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'flex-end' }}>
              <input type="hidden" name="tab" value="payouts" />
              <select name="payoutStatus" defaultValue={payoutStatus} className="input" style={{ width: 140 }}>
                <option value="">All statuses</option>
                <option value="PENDING">Pending</option>
                <option value="RELEASED">Released</option>
              </select>
              <input type="hidden" name="page" value="1" />
              <button className="button small" type="submit">Filter</button>
            </form>
            <h3 style={{ fontSize: 14, marginBottom: 8 }}>Accounts Payable ({payoutTotal})</h3>
            {payoutEntries.length === 0 ? <div className="empty">No payout entries.</div> : (
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
            {payoutPages > 1 && (
              <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
                {page > 1 && <Link className="button small secondary" href={pageHref(page - 1)}>← Prev</Link>}
                <span className="meta">Page {page} of {payoutPages}</span>
                {page < payoutPages && <Link className="button small secondary" href={pageHref(page + 1)}>Next →</Link>}
              </div>
            )}
          </>
        )}

        {activeTab === 'tickets' && (
          <>
            <form method="get" style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'flex-end' }}>
              <input type="hidden" name="tab" value="tickets" />
              <select name="ticketStatus" defaultValue={ticketStatus} className="input" style={{ width: 160 }}>
                <option value="">All statuses</option>
                <option value="RESERVED">Reserved (unpaid)</option>
                <option value="CAPTURED">Captured</option>
                <option value="VOID">Void</option>
              </select>
              <input type="hidden" name="page" value="1" />
              <button className="button small" type="submit">Filter</button>
            </form>
            <h3 style={{ fontSize: 14, marginBottom: 8 }}>Ticket Orders ({ticketOrderTotal})</h3>
            {ticketOrders.length === 0 ? <div className="empty">No ticket orders match this filter.</div> : (
              <div className="admin-list">
                {ticketOrders.map(o => (
                  <div className="admin-list-row" key={o.id}>
                    <span>{o.show.title}</span>
                    <small>{o.buyerName} · {o.buyerEmail}</small>
                    <strong>{o.status}</strong>
                    <small>{o.quantity} ticket{o.quantity === 1 ? '' : 's'} · ${(o.totalChargeCents / 100).toFixed(2)}</small>
                    <small>{o.createdAt.toISOString().slice(0, 10)}</small>
                    <Link className="button small secondary" href={`/shows/${o.show.slug}`}>View show</Link>
                  </div>
                ))}
              </div>
            )}
            {ticketPages > 1 && (
              <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
                {page > 1 && <Link className="button small secondary" href={pageHref(page - 1)}>← Prev</Link>}
                <span className="meta">Page {page} of {ticketPages}</span>
                {page < ticketPages && <Link className="button small secondary" href={pageHref(page + 1)}>Next →</Link>}
              </div>
            )}
          </>
        )}

        {activeTab === 'promo-codes' && (
          <>
            <form method="get" style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'flex-end' }}>
              <input type="hidden" name="tab" value="promo-codes" />
              <select name="promoStatus" defaultValue={promoStatus} className="input" style={{ width: 140 }}>
                <option value="">All codes</option>
                <option value="active">Active</option>
                <option value="expired">Expired</option>
              </select>
              <input type="hidden" name="page" value="1" />
              <button className="button small" type="submit">Filter</button>
            </form>
            <h3 style={{ fontSize: 14, marginBottom: 8 }}>Promo Codes ({promoTotal})</h3>
            {recentPromos.length === 0 ? <div className="empty">No promo codes.</div> : (
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
            {promoPages > 1 && (
              <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
                {page > 1 && <Link className="button small secondary" href={pageHref(page - 1)}>← Prev</Link>}
                <span className="meta">Page {page} of {promoPages}</span>
                {page < promoPages && <Link className="button small secondary" href={pageHref(page + 1)}>Next →</Link>}
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}

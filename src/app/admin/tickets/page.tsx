import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { isAdminSession } from '@/lib/permissions';
import { WORKBENCH_PATH } from '@/lib/auth-redirects';
import { db } from '@/lib/db';

export const metadata = {
  title: 'Tickets · Events | Admin | iHYPE',
  robots: { index: false, follow: false },
};

const PAGE_SIZE = 50;

/** Money is stored in cents everywhere; never render a raw cent count. */
function money(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '—';
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * A count that could not be read renders as an em dash, never as 0.
 *
 * Same rule the workbench board and the analytics engine already follow: 0 is
 * a claim ("nothing sold"), and a failed query has not earned it.
 */
function count(value: number | null): string {
  return value === null ? '—' : String(value);
}

export default async function AdminTicketsPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string; page?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  if (!isAdminSession(session)) redirect(WORKBENCH_PATH);

  const sp = searchParams ? await searchParams : {};
  const page = Math.max(1, parseInt(sp.page ?? '1', 10));
  const status = sp.status ?? '';

  const where: Record<string, unknown> = {};
  if (status) where.status = status;

  // Every query is independently caught. One failing read must not be able to
  // make the whole page claim the platform has sold nothing.
  const [orders, orderTotal, captured, reserved, refunded, scanned, valid, grossAgg] = await Promise.all([
    db.ticketOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      select: {
        id: true,
        confirmationCode: true,
        buyerName: true,
        buyerEmail: true,
        quantity: true,
        status: true,
        totalChargeCents: true,
        createdAt: true,
        refundedAt: true,
        show: { select: { title: true, slug: true } },
      },
    }).catch(() => null),
    db.ticketOrder.count({ where }).catch(() => null),
    db.ticketOrder.count({ where: { status: 'CAPTURED' } }).catch(() => null),
    db.ticketOrder.count({ where: { status: 'RESERVED' } }).catch(() => null),
    db.ticketOrder.count({ where: { refundedAt: { not: null } } }).catch(() => null),
    db.ticket.count({ where: { status: 'SCANNED' } }).catch(() => null),
    db.ticket.count({ where: { status: 'VALID' } }).catch(() => null),
    // Only CAPTURED orders are money that actually moved. A RESERVED order is
    // a held seat that may never be paid for — counting it as revenue is the
    // same mistake `tickets_sold` in the analytics catalogue exists to avoid.
    db.ticketOrder.aggregate({
      where: { status: 'CAPTURED' },
      _sum: { totalChargeCents: true },
    }).catch(() => null),
  ]);

  const totalPages = orderTotal === null ? 1 : Math.max(1, Math.ceil(orderTotal / PAGE_SIZE));

  const metrics: Array<[string, string]> = [
    ['Captured orders', count(captured)],
    ['Reserved (unpaid)', count(reserved)],
    ['Refunded', count(refunded)],
    ['Tickets valid', count(valid)],
    ['Tickets scanned', count(scanned)],
    ['Gross captured', grossAgg === null ? '—' : money(grossAgg._sum.totalChargeCents ?? 0)],
  ];

  const FILTERS: Array<[string, string]> = [
    ['', 'All'],
    ['CAPTURED', 'Captured'],
    ['RESERVED', 'Reserved'],
    ['VOID', 'Void'],
  ];

  const pageHref = (n: number) => `/admin/tickets?${status ? `status=${status}&` : ''}page=${n}`;

  return (
    <div className="container section admin-console">
      <section className="panel admin-console-panel">
        <h1 style={{ fontSize: '1.25rem', marginBottom: 4 }}>Event tickets</h1>
        <p className="meta">
          Ticket orders and the tickets issued against them. Refunds and transfers are
          member-initiated; this page shows their result rather than performing them.
        </p>

        <div className="admin-metric-grid" style={{ marginBottom: 20 }}>
          {metrics.map(([label, value]) => (
            <article className="card admin-metric-card" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </article>
          ))}
        </div>

        <div className="admin-export-row" style={{ marginBottom: 16 }}>
          {FILTERS.map(([value, label]) => (
            <Link
              key={value || 'all'}
              href={value ? `/admin/tickets?status=${value}` : '/admin/tickets'}
              className={`button small ${status === value ? '' : 'secondary'}`}
            >
              {label}
            </Link>
          ))}
        </div>

        {orders === null ? (
          <div className="empty">Orders could not be read. That is a failed query, not an empty ledger.</div>
        ) : orders.length === 0 ? (
          <div className="empty">No ticket orders match this filter.</div>
        ) : (
          <div className="admin-list">
            {orders.map((o) => (
              <div className="admin-list-row" key={o.id}>
                <span>
                  {o.show ? <Link href={`/shows/${o.show.slug}`}>{o.show.title}</Link> : 'Unknown show'}
                  {' · '}
                  {o.buyerName}
                </span>
                <strong>{money(o.totalChargeCents)}</strong>
                <small>
                  <code>{o.confirmationCode}</code> · {o.quantity} ticket{o.quantity === 1 ? '' : 's'} ·{' '}
                  {o.buyerEmail}
                </small>
                <small>
                  {o.refundedAt ? 'REFUNDED' : o.status} · {o.createdAt.toISOString().slice(0, 10)}
                </small>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="admin-export-row" style={{ marginTop: 16 }}>
            {page > 1 && <Link className="button small secondary" href={pageHref(page - 1)}>‹ Previous</Link>}
            <span className="meta">Page {page} of {totalPages}</span>
            {page < totalPages && <Link className="button small secondary" href={pageHref(page + 1)}>Next ›</Link>}
          </div>
        )}
      </section>
    </div>
  );
}

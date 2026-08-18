import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { isAdminSession } from '@/lib/permissions';
import { WORKBENCH_PATH } from '@/lib/auth-redirects';
import { db } from '@/lib/db';

export const metadata = {
  title: 'Tickets · Support | Admin | iHYPE',
  robots: { index: false, follow: false },
};

const PAGE_SIZE = 50;

/** A count that could not be read renders as an em dash, never as 0. */
function count(value: number | null): string {
  return value === null ? '—' : String(value);
}

/**
 * How long a request has been waiting. An operator triages a queue by age, not
 * by volume — same reason the workbench board sorts on longest wait rather than
 * largest count.
 */
function age(from: Date): string {
  const hours = Math.floor((Date.now() - from.getTime()) / 3_600_000);
  if (hours < 1) return 'under 1h';
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export default async function AdminSupportTicketsPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string; page?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  if (!isAdminSession(session)) redirect(WORKBENCH_PATH);

  const sp = searchParams ? await searchParams : {};
  const page = Math.max(1, parseInt(sp.page ?? '1', 10));
  // Default to the queue that needs a human, not to everything ever filed.
  const status = sp.status ?? 'OPEN';

  const where: Record<string, unknown> = {};
  if (status !== 'ALL') where.status = status;

  const [requests, total, open, urgent, closed] = await Promise.all([
    db.supportRequest.findMany({
      where,
      // Oldest first. The queue is worked by wait time, so the request that has
      // been waiting longest is the one to see first — the opposite of every
      // other list in this console, and deliberate.
      orderBy: { createdAt: 'asc' },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      select: {
        id: true,
        type: true,
        subject: true,
        name: true,
        email: true,
        status: true,
        priority: true,
        createdAt: true,
      },
    }).catch(() => null),
    db.supportRequest.count({ where }).catch(() => null),
    db.supportRequest.count({ where: { status: 'OPEN' } }).catch(() => null),
    db.supportRequest.count({ where: { status: 'OPEN', priority: 'URGENT' } }).catch(() => null),
    db.supportRequest.count({ where: { status: 'CLOSED' } }).catch(() => null),
  ]);

  const totalPages = total === null ? 1 : Math.max(1, Math.ceil(total / PAGE_SIZE));
  const FILTERS: Array<[string, string]> = [
    ['OPEN', 'Open'],
    ['CLOSED', 'Closed'],
    ['ALL', 'All'],
  ];

  const metrics: Array<[string, string]> = [
    ['Open', count(open)],
    ['Open · urgent', count(urgent)],
    ['Closed', count(closed)],
  ];

  return (
    <div className="container section admin-console">
      <section className="panel admin-console-panel">
        <h1 style={{ fontSize: '1.25rem', marginBottom: 4 }}>Support requests</h1>
        <p className="meta">
          Everything members filed through <Link href="/support">/support</Link>, including refund
          and privacy requests. Members see their own at <code>/support/tickets</code>.
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
              key={value}
              href={`/admin/tickets/support?status=${value}`}
              className={`button small ${status === value ? '' : 'secondary'}`}
            >
              {label}
            </Link>
          ))}
        </div>

        {requests === null ? (
          <div className="empty">Requests could not be read. That is a failed query, not an empty queue.</div>
        ) : requests.length === 0 ? (
          <div className="empty">Nothing waiting in this queue.</div>
        ) : (
          <div className="admin-list">
            {requests.map((r) => (
              <div className="admin-list-row" key={r.id}>
                <span>
                  <Link href={`/support/tickets/${r.id}`}>{r.subject}</Link>
                </span>
                <strong>{age(r.createdAt)}</strong>
                <small>
                  {r.type} · {r.name ?? 'no name'} · {r.email ?? 'no address'}
                </small>
                <small>
                  {r.priority} · {r.status}
                </small>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="admin-export-row" style={{ marginTop: 16 }}>
            {page > 1 && (
              <Link className="button small secondary" href={`/admin/tickets/support?status=${status}&page=${page - 1}`}>
                ‹ Previous
              </Link>
            )}
            <span className="meta">Page {page} of {totalPages}</span>
            {page < totalPages && (
              <Link className="button small secondary" href={`/admin/tickets/support?status=${status}&page=${page + 1}`}>
                Next ›
              </Link>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

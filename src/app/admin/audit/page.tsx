import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AdminNav } from '@/components/AdminNav';
import { auth } from '@/lib/auth';
import { WORKBENCH_PATH } from '@/lib/auth-redirects';
import { db } from '@/lib/db';
import { isAdminSession } from '@/lib/permissions';

export const metadata: Metadata = {
  title: 'Audit log | iHYPE Admin',
  robots: { index: false, follow: false }
};

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

type SearchParams = { action?: string; actor?: string; entity?: string; from?: string; to?: string; page?: string };

export default async function AdminAuditPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  if (!isAdminSession(session)) redirect(WORKBENCH_PATH);

  const sp = searchParams ? await searchParams : {};
  const action = sp.action?.trim() || undefined;
  const actor = sp.actor?.trim() || undefined;
  const entity = sp.entity?.trim() || undefined;
  const from = sp.from ? new Date(sp.from) : undefined;
  const to = sp.to ? new Date(sp.to) : undefined;
  const page = Math.max(1, parseInt(sp.page ?? '1', 10));

  const where: Record<string, unknown> = {};
  if (action) where.action = { contains: action };
  if (entity) where.entityType = entity;
  if (actor) where.actor = { OR: [{ email: { contains: actor, mode: 'insensitive' } }, { username: { contains: actor, mode: 'insensitive' } }] };
  if (from || to) where.createdAt = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };

  const [rows, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      include: { actor: { select: { email: true, username: true } } },
    }),
    db.auditLog.count({ where }),
  ]);

  const pages = Math.ceil(total / PAGE_SIZE);
  const exportUrl = new URLSearchParams({ ...(action ? { action } : {}), ...(actor ? { actor } : {}), ...(entity ? { entity } : {}), ...(sp.from ? { from: sp.from } : {}), ...(sp.to ? { to: sp.to } : {}) });
  const qs = (p: number) => {
    const params = new URLSearchParams({ ...(action ? { action } : {}), ...(actor ? { actor } : {}), ...(entity ? { entity } : {}), ...(sp.from ? { from: sp.from } : {}), ...(sp.to ? { to: sp.to } : {}), page: String(p) });
    return `/admin/audit?${params}`;
  };

  return (
    <main className="container section admin-console">
      <AdminNav active="audit" />
      <section className="panel">
        <h1>Audit log <span className="meta">({total.toLocaleString()} events)</span></h1>
        <form method="get" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', margin: '12px 0' }}>
          <label style={{ display: 'grid', gap: 4 }}>
            <span className="meta">Action contains</span>
            <input className="input" name="action" defaultValue={action ?? ''} />
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <span className="meta">Actor email/username</span>
            <input className="input" name="actor" defaultValue={actor ?? ''} />
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <span className="meta">Entity type</span>
            <input className="input" name="entity" defaultValue={entity ?? ''} />
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <span className="meta">From</span>
            <input className="input" type="date" name="from" defaultValue={sp.from ?? ''} />
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <span className="meta">To</span>
            <input className="input" type="date" name="to" defaultValue={sp.to ?? ''} />
          </label>
          <input type="hidden" name="page" value="1" />
          <button className="button small" type="submit">Search</button>
          <Link className="button small secondary" href={`/api/admin/audit/export?${exportUrl.toString()}`}>Export CSV</Link>
        </form>

        <table className="table">
          <thead>
            <tr>
              <th>Time</th><th>Actor</th><th>Action</th><th>Entity</th><th>Entity ID</th><th>Meta</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? rows.map((r) => (
              <tr key={r.id}>
                <td style={{ whiteSpace: 'nowrap' }}>{r.createdAt.toISOString().replace('T', ' ').slice(0, 19)}</td>
                <td>{r.actor?.username ?? r.actor?.email ?? 'system'}</td>
                <td>{r.action}</td>
                <td>{r.entityType}</td>
                <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{r.entityId ? r.entityId.slice(0, 12) + '…' : '—'}</td>
                <td>
                  {r.metadata ? (
                    <details style={{ cursor: 'pointer' }}>
                      <summary style={{ fontSize: 11, opacity: 0.6 }}>view</summary>
                      <pre style={{ fontSize: 10, maxWidth: 300, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                        {JSON.stringify(r.metadata, null, 2)}
                      </pre>
                    </details>
                  ) : '—'}
                </td>
              </tr>
            )) : (
              <tr><td colSpan={6}><div className="empty">No matching events.</div></td></tr>
            )}
          </tbody>
        </table>

        {pages > 1 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
            {page > 1 && <Link className="button small secondary" href={qs(page - 1)}>← Prev</Link>}
            <span className="meta">Page {page} of {pages} · {total.toLocaleString()} events</span>
            {page < pages && <Link className="button small secondary" href={qs(page + 1)}>Next →</Link>}
          </div>
        )}
      </section>
    </main>
  );
}

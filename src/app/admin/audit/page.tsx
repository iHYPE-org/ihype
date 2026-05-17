import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AdminNav } from '@/components/AdminNav';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isAdminSession } from '@/lib/permissions';

export const metadata: Metadata = {
  title: 'Audit log | iHYPE Admin',
  robots: { index: false, follow: false }
};

export const dynamic = 'force-dynamic';

type SearchParams = {
  action?: string;
  actor?: string;
  entity?: string;
  from?: string;
  to?: string;
};

export default async function AdminAuditPage({
  searchParams
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  if (!isAdminSession(session)) redirect('/auth/landing');

  const sp = searchParams ? await searchParams : {};
  const action = sp.action?.trim() || undefined;
  const actor = sp.actor?.trim() || undefined;
  const entity = sp.entity?.trim() || undefined;
  const from = sp.from ? new Date(sp.from) : undefined;
  const to = sp.to ? new Date(sp.to) : undefined;

  const where: Record<string, unknown> = {};
  if (action) where.action = { contains: action };
  if (entity) where.entityType = entity;
  if (actor) {
    where.actor = {
      OR: [
        { email: { contains: actor, mode: 'insensitive' } },
        { username: { contains: actor, mode: 'insensitive' } }
      ]
    };
  }
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {})
    };
  }

  const rows = await db.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { actor: { select: { email: true, username: true } } }
  });

  const exportUrl = new URLSearchParams();
  if (action) exportUrl.set('action', action);
  if (actor) exportUrl.set('actor', actor);
  if (entity) exportUrl.set('entity', entity);
  if (sp.from) exportUrl.set('from', sp.from);
  if (sp.to) exportUrl.set('to', sp.to);

  return (
    <main className="container section admin-console">
      <AdminNav active="audit" />
      <section className="panel">
        <h1>Audit log</h1>
        <p className="meta">Search the last events. Max 200 rows displayed.</p>
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
          <button className="button small" type="submit">Search</button>
          <Link className="button small secondary" href={`/api/admin/audit/export?${exportUrl.toString()}`}>
            Export CSV
          </Link>
        </form>
        <table className="table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Entity ID</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? rows.map((r) => (
              <tr key={r.id}>
                <td>{r.createdAt.toISOString()}</td>
                <td>{r.actor?.username ?? r.actor?.email ?? 'system'}</td>
                <td>{r.action}</td>
                <td>{r.entityType}</td>
                <td>{r.entityId ?? '—'}</td>
              </tr>
            )) : (
              <tr><td colSpan={5}><div className="empty">No matching events.</div></td></tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}

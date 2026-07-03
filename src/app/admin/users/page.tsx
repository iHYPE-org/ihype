import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { WORKBENCH_PATH } from '@/lib/auth-redirects';
import { db } from '@/lib/db';
import { isAdminSession } from '@/lib/permissions';
import { promoteToAdminAction, suspendUserAction } from './actions';

export const metadata: Metadata = {
  title: 'User management | iHYPE Admin',
  robots: { index: false, follow: false }
};

const PAGE_SIZE = 25;

type SearchParams = { q?: string; role?: string; page?: string };

export default async function AdminUsersPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  if (!isAdminSession(session)) redirect(WORKBENCH_PATH);

  const sp = (await searchParams) ?? {};
  const q = (sp.q ?? '').trim();
  const role = sp.role ?? '';
  const page = Math.max(1, parseInt(sp.page ?? '1', 10));

  const where: Record<string, unknown> = {};
  if (q) where.OR = [{ email: { contains: q, mode: 'insensitive' } }, { username: { contains: q, mode: 'insensitive' } }];
  if (role) where.role = role;

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      orderBy: { createdAt: 'desc' },
      select: { id: true, email: true, username: true, role: true, createdAt: true, _count: { select: { passkeys: true } } },
    }),
    db.user.count({ where }),
  ]);

  const pages = Math.ceil(total / PAGE_SIZE);
  const qs = (overrides: Record<string, string>) => {
    const p = new URLSearchParams({ ...(q ? { q } : {}), ...(role ? { role } : {}), page: String(page), ...overrides });
    return `/admin/users?${p}`;
  };

  return (
    <main className="container section admin-console">
      <section className="panel admin-console-hero">
        <div>
          <div className="badge">User management</div>
          <h1>Users <span className="meta">({total.toLocaleString()} total)</span></h1>
        </div>
      </section>

      <section className="panel admin-console-panel">
        <form method="get" style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <input name="q" defaultValue={q} placeholder="Search email or username…" className="input" style={{ flex: 1, minWidth: 180 }} />
          <select name="role" defaultValue={role} className="input" style={{ width: 130 }}>
            <option value="">All roles</option>
            <option value="USER">USER</option>
            <option value="ADMIN">ADMIN</option>
          </select>
          <input type="hidden" name="page" value="1" />
          <button className="button" type="submit">Filter</button>
          {(q || role) && <Link className="button secondary" href="/admin/users">Clear</Link>}
        </form>

        <div className="admin-list">
          {users.length === 0 ? (
            <div className="empty">No users found.</div>
          ) : users.map((user) => (
            <div className="admin-list-row" key={user.id} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ minWidth: 140 }}>{user.username || '—'}</span>
              <strong style={{ minWidth: 220 }}>{user.email || '—'}</strong>
              <small>{user.role}</small>
              <small>{user.createdAt.toISOString().slice(0, 10)}</small>
              <small>{user._count.passkeys} passkey{user._count.passkeys === 1 ? '' : 's'}</small>
              <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
                <form action={suspendUserAction}>
                  <input type="hidden" name="userId" value={user.id} />
                  <button className="button small secondary" type="submit">Suspend</button>
                </form>
                {user.role !== 'ADMIN' && (
                  <form action={promoteToAdminAction}>
                    <input type="hidden" name="userId" value={user.id} />
                    <button className="button small" type="submit">Make Admin</button>
                  </form>
                )}
              </div>
            </div>
          ))}
        </div>

        {pages > 1 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 16, alignItems: 'center' }}>
            {page > 1 && <Link className="button small secondary" href={qs({ page: String(page - 1) })}>← Prev</Link>}
            <span className="meta">Page {page} of {pages}</span>
            {page < pages && <Link className="button small secondary" href={qs({ page: String(page + 1) })}>Next →</Link>}
          </div>
        )}
      </section>
    </main>
  );
}

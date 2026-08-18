import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { WORKBENCH_PATH } from '@/lib/auth-redirects';
import { db } from '@/lib/db';
import { isAdminSession } from '@/lib/permissions';
import { promoteToAdminAction, suspendUserAction } from './actions';
import { getServerT } from '@/lib/i18n/server';
import { ImpersonateButton } from '@/components/admin/ImpersonateButton';

export const metadata: Metadata = {
  title: 'User management | iHYPE Admin',
  robots: { index: false, follow: false }
};

const PAGE_SIZE = 25;

type SearchParams = { q?: string; role?: string; page?: string; tab?: string };

/**
 * The real Role enum. The filter used to offer USER and ADMIN — and USER is not
 * a member of Role (FAN is), so picking it filtered on a value no row can hold
 * and reported "No users found" on a populated table. DJ was removed from the
 * enum by the MMM cutover and is deliberately absent.
 */
const ROLES = ['FAN', 'ARTIST', 'VENUE', 'ADVERTISER', 'ADMIN'] as const;

export default async function AdminUsersPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  if (!isAdminSession(session)) redirect(WORKBENCH_PATH);

  const t = await getServerT();
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

  const tab = sp.tab === 'stats' ? 'stats' : 'roles';

  // Only paid for on the Stats tab. Each read is independently caught and
  // renders as an em dash on failure — a dashboard showing 0 for "could not be
  // read" makes a claim it has not earned, the rule the analytics engine and
  // the workbench board both follow.
  const day = 24 * 60 * 60 * 1000;
  const stats = tab !== 'stats' ? null : await Promise.all([
    db.user.groupBy({ by: ['role'], _count: { _all: true } }).catch(() => null),
    db.user.count({ where: { createdAt: { gte: new Date(Date.now() - 7 * day) } } }).catch(() => null),
    db.user.count({ where: { createdAt: { gte: new Date(Date.now() - 30 * day) } } }).catch(() => null),
    db.user.count({ where: { passkeys: { some: {} } } }).catch(() => null),
    // Signup stopped asking fans for an address, and the passkey path asks for
    // nothing at all, so an account can exist whose only credential is one
    // device. This is how many have no recovery address attached.
    db.user.count({ where: { email: null } }).catch(() => null),
    // Null means "signed up before consent was recorded", not "unknown" —
    // pre-existing rows were deliberately not backfilled.
    db.user.count({ where: { tosAcceptedAt: { not: null } } }).catch(() => null),
  ]);

  const num = (v: number | null) => (v === null ? '—' : v.toLocaleString());

  const pages = Math.ceil(total / PAGE_SIZE);
  const qs = (overrides: Record<string, string>) => {
    const p = new URLSearchParams({ ...(q ? { q } : {}), ...(role ? { role } : {}), page: String(page), ...overrides });
    return `/admin/users?${p}`;
  };

  return (
    <div className="container section admin-console">
      <section className="panel admin-console-hero">
        <div>
          <div className="badge">{t('adminUsersPage.badge', 'User management')}</div>
          <h1>{t('adminUsersPage.title', 'Users')} <span className="meta">({total.toLocaleString()} {t('adminUsersPage.total', 'total')})</span></h1>
        </div>
      </section>

      <section className="panel admin-console-panel">
        <div className="admin-export-row" style={{ marginBottom: 16 }}>
          <Link className={`button small ${tab === 'roles' ? '' : 'secondary'}`} href="/admin/users">
            {t('adminUsersPage.tabRoles', 'Roles')}
          </Link>
          <Link className={`button small ${tab === 'stats' ? '' : 'secondary'}`} href="/admin/users?tab=stats">
            {t('adminUsersPage.tabStats', 'Stats')}
          </Link>
        </div>

        {tab === 'stats' && stats && (() => {
          const [byRole, last7, last30, withPasskey, noEmail, tosAccepted] = stats;
          const roleCount = (r: string) => {
            if (byRole === null) return '—';
            const row = byRole.find((x) => String(x.role) === r);
            return (row?._count._all ?? 0).toLocaleString();
          };
          return (
            <>
              <div className="admin-metric-grid" style={{ marginBottom: 20 }}>
                {ROLES.map((r) => (
                  <article className="card admin-metric-card" key={r}>
                    <span>{r}</span>
                    <strong>{roleCount(r)}</strong>
                  </article>
                ))}
                <article className="card admin-metric-card">
                  <span>{t('adminUsersPage.statTotal', 'Total')}</span>
                  <strong>{total.toLocaleString()}</strong>
                </article>
              </div>
              <div className="admin-list">
                <div className="admin-list-row">
                  <span>{t('adminUsersPage.statNew7', 'Signed up in the last 7 days')}</span>
                  <strong>{num(last7)}</strong>
                </div>
                <div className="admin-list-row">
                  <span>{t('adminUsersPage.statNew30', 'Signed up in the last 30 days')}</span>
                  <strong>{num(last30)}</strong>
                </div>
                <div className="admin-list-row">
                  <span>{t('adminUsersPage.statPasskey', 'Accounts with at least one passkey')}</span>
                  <strong>{num(withPasskey)}</strong>
                </div>
                <div className="admin-list-row">
                  <span>{t('adminUsersPage.statNoEmail', 'Accounts with no recovery email')}</span>
                  <strong>{num(noEmail)}</strong>
                  <small>
                    {t(
                      'adminUsersPage.statNoEmailNote',
                      'Passkey-only accounts. Losing the device loses the account until a recovery address is added in Settings.',
                    )}
                  </small>
                </div>
                <div className="admin-list-row">
                  <span>{t('adminUsersPage.statTos', 'Terms acceptance recorded')}</span>
                  <strong>{num(tosAccepted)}</strong>
                  <small>
                    {t(
                      'adminUsersPage.statTosNote',
                      'Null on accounts created before acceptance was recorded — that is "not recorded", not "declined".',
                    )}
                  </small>
                </div>
              </div>
            </>
          );
        })()}

        {tab === 'roles' && (
        <form method="get" style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <input name="q" defaultValue={q} placeholder={t('adminUsersPage.searchPlaceholder', 'Search email or username…')} className="input" style={{ flex: 1, minWidth: 180 }} />
          <select name="role" defaultValue={role} className="input" style={{ width: 130 }}>
            <option value="">{t('adminUsersPage.allRoles', 'All roles')}</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <input type="hidden" name="page" value="1" />
          <button className="button" type="submit">{t('adminUsersPage.filter', 'Filter')}</button>
          {(q || role) && <Link className="button secondary" href="/admin/users">{t('adminUsersPage.clear', 'Clear')}</Link>}
        </form>
        )}

        {tab === 'roles' && (
        <div className="admin-list">
          {users.length === 0 ? (
            <div className="empty">{t('adminUsersPage.noUsers', 'No users found.')}</div>
          ) : users.map((user) => (
            <div className="admin-list-row" key={user.id} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ minWidth: 140 }}>{user.username || '—'}</span>
              <strong style={{ minWidth: 220 }}>{user.email || '—'}</strong>
              <small>{user.role}</small>
              <small>{user.createdAt.toISOString().slice(0, 10)}</small>
              <small>{user._count.passkeys} {t('adminUsersPage.passkeyLabel', 'passkey')}{user._count.passkeys === 1 ? '' : 's'}</small>
              <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
                <form action={suspendUserAction}>
                  <input type="hidden" name="userId" value={user.id} />
                  <button className="button small secondary" type="submit">{t('adminUsersPage.suspend', 'Suspend')}</button>
                </form>
                {/* Never offered for an ADMIN row — impersonating another
                    administrator would be a privilege-escalation path around
                    the allowlist. The server refuses it too; this only keeps
                    the button from being there to press. */}
                {user.role !== 'ADMIN' && <ImpersonateButton email={user.email} userId={user.id} />}
                {user.role !== 'ADMIN' && (
                  <form action={promoteToAdminAction}>
                    <input type="hidden" name="userId" value={user.id} />
                    <button className="button small" type="submit">{t('adminUsersPage.makeAdmin', 'Make Admin')}</button>
                  </form>
                )}
              </div>
            </div>
          ))}
        </div>
        )}

        {tab === 'roles' && pages > 1 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 16, alignItems: 'center' }}>
            {page > 1 && <Link className="button small secondary" href={qs({ page: String(page - 1) })}>{t('adminUsersPage.prev', '← Prev')}</Link>}
            <span className="meta">{t('adminUsersPage.pageOf', 'Page')} {page} {t('adminUsersPage.of', 'of')} {pages}</span>
            {page < pages && <Link className="button small secondary" href={qs({ page: String(page + 1) })}>{t('adminUsersPage.next', 'Next →')}</Link>}
          </div>
        )}
      </section>
    </div>
  );
}

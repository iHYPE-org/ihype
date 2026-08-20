import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { WORKBENCH_PATH } from '@/lib/auth-redirects';
import { db } from '@/lib/db';
import { isAdminSession } from '@/lib/permissions';
import { getServerT } from '@/lib/i18n/server';

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
  const t = await getServerT();

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
    <div className="container section admin-console">
      <section className="panel">
        <h1>{t('adminAuditPage.title', 'Audit log')} <span className="meta">({total.toLocaleString()} {t('adminAuditPage.eventsSuffix', 'events')})</span></h1>
        <form method="get" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', margin: '12px 0' }}>
          <label style={{ display: 'grid', gap: 4 }}>
            <span className="meta">{t('adminAuditPage.filterActionLabel', 'Action contains')}</span>
            <input className="input" name="action" defaultValue={action ?? ''} />
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <span className="meta">{t('adminAuditPage.filterActorLabel', 'Actor email/username')}</span>
            <input className="input" name="actor" defaultValue={actor ?? ''} />
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <span className="meta">{t('adminAuditPage.filterEntityLabel', 'Entity type')}</span>
            <input className="input" name="entity" defaultValue={entity ?? ''} />
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <span className="meta">{t('adminAuditPage.filterFromLabel', 'From')}</span>
            <input className="input" type="date" name="from" defaultValue={sp.from ?? ''} />
          </label>
          <label style={{ display: 'grid', gap: 4 }}>
            <span className="meta">{t('adminAuditPage.filterToLabel', 'To')}</span>
            <input className="input" type="date" name="to" defaultValue={sp.to ?? ''} />
          </label>
          <input type="hidden" name="page" value="1" />
          <button className="button small" type="submit">{t('adminAuditPage.searchButton', 'Search')}</button>
          <Link className="button small secondary" href={`/api/admin/audit/export?${exportUrl.toString()}`}>{t('adminAuditPage.exportCsv', 'Export CSV')}</Link>
        </form>

        <table className="table">
          <thead>
            <tr>
              <th>{t('adminAuditPage.colTime', 'Time')}</th><th>{t('adminAuditPage.colActor', 'Actor')}</th><th>{t('adminAuditPage.colAction', 'Action')}</th><th>{t('adminAuditPage.colEntity', 'Entity')}</th><th>{t('adminAuditPage.colEntityId', 'Entity ID')}</th><th>{t('adminAuditPage.colMeta', 'Meta')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? rows.map((r) => (
              <tr key={r.id}>
                <td style={{ whiteSpace: 'nowrap' }}>{r.createdAt.toISOString().replace('T', ' ').slice(0, 19)}</td>
                <td>{r.actor?.username ?? r.actor?.email ?? t('adminAuditPage.systemActor', 'system')}</td>
                <td>{r.action}</td>
                <td>{r.entityType}</td>
                <td style={{ fontFamily: 'monospace', fontSize: '0.9375rem' }}>{r.entityId ? r.entityId.slice(0, 12) + '…' : '—'}</td>
                <td>
                  {r.metadata ? (
                    <details style={{ cursor: 'pointer' }}>
                      <summary style={{ fontSize: '0.9375rem', opacity: 0.6 }}>{t('adminAuditPage.viewDetails', 'view')}</summary>
                      <pre style={{ fontSize: '0.9375rem', maxWidth: 300, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                        {JSON.stringify(r.metadata, null, 2)}
                      </pre>
                    </details>
                  ) : '—'}
                </td>
              </tr>
            )) : (
              <tr><td colSpan={6}><div className="empty">{t('adminAuditPage.noMatches', 'No matching events.')}</div></td></tr>
            )}
          </tbody>
        </table>

        {pages > 1 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
            {page > 1 && <Link className="button small secondary" href={qs(page - 1)}>{t('adminAuditPage.prevPage', '← Prev')}</Link>}
            <span className="meta">{t('adminAuditPage.pageSummary', 'Page')} {page} {t('adminAuditPage.pageOf', 'of')} {pages} · {total.toLocaleString()} {t('adminAuditPage.eventsSuffix', 'events')}</span>
            {page < pages && <Link className="button small secondary" href={qs(page + 1)}>{t('adminAuditPage.nextPage', 'Next →')}</Link>}
          </div>
        )}
      </section>
    </div>
  );
}

import Link from 'next/link';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { ModerationActions } from '@/components/ModerationActions';
import { getServerT } from '@/lib/i18n/server';
import { isAdminSession } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 25;

type SearchParams = { status?: string; type?: string; page?: string };

export default async function ModerationPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const session = await auth();
  // The same check every other admin page runs, so none of them relies on the
  // layout's redirect alone (a streamed page cannot be stopped by its layout).
  if (!isAdminSession(session)) redirect('/');

  const t = await getServerT();
  const sp = (await searchParams) ?? {};
  const status = sp.status ?? 'OPEN';
  const type = sp.type ?? '';
  const page = Math.max(1, parseInt(sp.page ?? '1', 10));

  const where: Record<string, unknown> = { status };
  if (type) where.targetType = type;

  const [reports, total] = await Promise.all([
    db.contentReport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      select: { id: true, reason: true, details: true, targetType: true, targetId: true, status: true, createdAt: true, reporter: { select: { username: true } } },
    }),
    db.contentReport.count({ where }),
  ]);

  const pages = Math.ceil(total / PAGE_SIZE);
  const qs = (overrides: Record<string, string>) => {
    const p = new URLSearchParams({ status, ...(type ? { type } : {}), page: String(page), ...overrides });
    return `/admin/moderation?${p}`;
  };

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 60 }}>
      <h1>{t('adminModerationPage.title', 'Content Moderation')} <span className="meta">({total} {status.toLowerCase()})</span></h1>

      <form method="get" style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <select name="status" defaultValue={status} className="input" style={{ width: 140 }}>
          <option value="OPEN">{t('adminModerationPage.statusOpen', 'Open')}</option>
          <option value="ACTIONED">{t('adminModerationPage.statusActioned', 'Actioned')}</option>
          <option value="DISMISSED">{t('adminModerationPage.statusDismissed', 'Dismissed')}</option>
        </select>
        <select name="type" defaultValue={type} className="input" style={{ width: 140 }}>
          <option value="">{t('adminModerationPage.typeAll', 'All types')}</option>
          <option value="profile">{t('adminModerationPage.typeProfile', 'Profile')}</option>
          <option value="profile-image">{t('adminModerationPage.typeProfileImage', 'Profile image')}</option>
          <option value="show">{t('adminModerationPage.typeShow', 'Show')}</option>
          <option value="comment">{t('adminModerationPage.typeComment', 'Comment')}</option>
          <option value="track">{t('adminModerationPage.typeTrack', 'Track')}</option>
          <option value="ad-audio">{t('adminModerationPage.typeAdAudio', 'Ad audio')}</option>
        </select>
        <input type="hidden" name="page" value="1" />
        <button className="button" type="submit">{t('adminModerationPage.filter', 'Filter')}</button>
        {(status !== 'OPEN' || type) && <Link className="button secondary" href="/admin/moderation">{t('adminModerationPage.reset', 'Reset')}</Link>}
      </form>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {reports.length === 0 && <p className="meta">{t('adminModerationPage.noReports', 'No reports found.')}</p>}
        {reports.map(r => (
          <div key={r.id} className="panel" style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 600 }}>{r.targetType} · <span className="meta">{r.reason}</span></div>
                <div className="meta">{r.details}</div>
                <div className="meta">{t('adminModerationPage.reportedBy', 'Reported by')} {r.reporter?.username ?? t('adminModerationPage.anonymous', 'anonymous')} · {new Date(r.createdAt).toLocaleDateString()}</div>
                <div className="meta">{t('adminModerationPage.contentId', 'Content ID:')} {r.targetId}</div>
              </div>
              {r.status === 'OPEN' && <ModerationActions reportId={r.id} />}
              {r.status !== 'OPEN' && <span className="badge">{r.status}</span>}
            </div>
          </div>
        ))}
      </div>

      {pages > 1 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 16, alignItems: 'center' }}>
          {page > 1 && <Link className="button small secondary" href={qs({ page: String(page - 1) })}>{t('adminModerationPage.prev', '← Prev')}</Link>}
          <span className="meta">{t('adminModerationPage.pageOf', 'Page')} {page} {t('adminModerationPage.of', 'of')} {pages}</span>
          {page < pages && <Link className="button small secondary" href={qs({ page: String(page + 1) })}>{t('adminModerationPage.next', 'Next →')}</Link>}
        </div>
      )}
    </div>
  );
}

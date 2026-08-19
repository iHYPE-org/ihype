import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { WORKBENCH_PATH } from '@/lib/auth-redirects';
import { db } from '@/lib/db';
import { isAdminSession } from '@/lib/permissions';
import { AdminVerificationQueue } from '@/app/admin/verifications/AdminVerificationQueue';
import { ReportPageBulkButtons } from '@/components/admin/ReportPageBulkButtons';
import type { VerificationProfile } from '@/lib/types/admin';
import React from 'react';
import { getServerT } from '@/lib/i18n/server';

export const metadata: Metadata = {
  title: 'Review Queue | Admin | iHYPE.org',
  robots: { index: false, follow: false }
};

export const dynamic = 'force-dynamic';

type Tab = 'reports' | 'verifications' | 'duplicates';

const thStyle: React.CSSProperties = { textAlign: 'left', padding: '8px 12px', fontWeight: 600, fontSize: '0.7813rem' };
const tdStyle: React.CSSProperties = { padding: '10px 12px', color: 'var(--ink)', verticalAlign: 'middle' };

async function resolveReport(reportId: string) {
  'use server';
  const session = await auth();
  if (!isAdminSession(session)) throw new Error('Forbidden');
  await db.contentReport.update({ where: { id: reportId }, data: { status: 'RESOLVED' } });
}

function ResolveButton({ reportId, label }: { reportId: string; label: string }) {
  return (
    <form action={resolveReport.bind(null, reportId)}>
      <button type="submit" style={{ background: 'rgba(var(--role-venue-rgb),.12)', color: 'var(--role-venue)', border: '1px solid rgba(var(--role-venue-rgb),.2)', borderRadius: 6, padding: '4px 12px', fontSize: '0.7813rem', cursor: 'pointer', fontFamily: 'var(--f-m)', letterSpacing: '.04em' }}>
        {label}
      </button>
    </form>
  );
}

type Report = {
  id: string;
  createdAt: Date;
  reason: string;
  targetType: string;
  targetId: string;
  status: string;
  reporter: { id: string; name: string | null; email: string | null } | null;
};

const REPORT_PAGE_SIZE = 25;

export default async function AdminReviewPage({
  searchParams
}: {
  searchParams?: Promise<{ tab?: string; status?: string; type?: string; from?: string; to?: string; page?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  if (!isAdminSession(session)) redirect(WORKBENCH_PATH);

  const t = await getServerT();
  const resolved = searchParams ? await searchParams : {};
  const rawTab = resolved.tab;
  const tab: Tab = rawTab === 'verifications' || rawTab === 'duplicates' ? rawTab : 'reports';
  const rStatus = resolved.status ?? 'OPEN';
  const rType = resolved.type ?? '';
  const rFrom = resolved.from ? new Date(resolved.from) : undefined;
  const rTo = resolved.to ? new Date(resolved.to) : undefined;
  const rPage = Math.max(1, parseInt(resolved.page ?? '1', 10));

  // ── REPORTS ──
  let reports: Report[] = [];
  let reportsTotal = 0;
  let profileMap = new Map<string, { id: string; name: string; slug: string; type: string }>();
  let showMap = new Map<string, { id: string; title: string; slug: string }>();
  let commentMap = new Map<string, { id: string; content: string }>();

  if (tab === 'reports') {
    const rWhere: Record<string, unknown> = { status: rStatus };
    if (rType) rWhere.targetType = rType;
    if (rFrom || rTo) rWhere.createdAt = { ...(rFrom ? { gte: rFrom } : {}), ...(rTo ? { lte: rTo } : {}) };

    const [raw, total] = await Promise.all([
      db.contentReport.findMany({
        where: rWhere,
        orderBy: { createdAt: 'desc' },
        take: REPORT_PAGE_SIZE,
        skip: (rPage - 1) * REPORT_PAGE_SIZE,
        include: { reporter: { select: { id: true, name: true, email: true } } },
      }),
      db.contentReport.count({ where: rWhere }),
    ]);
    reports = raw as Report[];
    reportsTotal = total;
    const profileIds = reports.filter(r => r.targetType === 'profile').map(r => r.targetId);
    const showIds = reports.filter(r => r.targetType === 'show').map(r => r.targetId);
    const commentIds = reports.filter(r => r.targetType === 'comment').map(r => r.targetId);
    const [profiles, shows, comments] = await Promise.all([
      profileIds.length > 0 ? db.profile.findMany({ where: { id: { in: profileIds } }, select: { id: true, name: true, slug: true, type: true } }) : [],
      showIds.length > 0 ? db.show.findMany({ where: { id: { in: showIds } }, select: { id: true, title: true, slug: true } }) : [],
      commentIds.length > 0 ? db.showComment.findMany({ where: { id: { in: commentIds } }, select: { id: true, content: true } }) : []
    ]);
    profileMap = new Map(profiles.map(p => [p.id, p]));
    showMap = new Map(shows.map(s => [s.id, s]));
    commentMap = new Map(comments.map(c => [c.id, c]));
  }

  // ── VERIFICATIONS ──
  let pendingProfiles: VerificationProfile[] = [];
  let verifiedCount = 0;

  if (tab === 'verifications') {
    [pendingProfiles, verifiedCount] = await Promise.all([
      db.profile.findMany({
        // verificationRequested is the discriminator between a real
        // submission and a legacy auto-stamp. Until today, registration set
        // every new ARTIST/VENUE/DJ to PENDING at signup, so this queue filled
        // with profiles that had never submitted anything and had no proof
        // attached to look at. Only POST /api/verify sets this flag, and it
        // defaults false, so filtering on it leaves exactly the rows a human
        // can actually act on.
        where: { verificationStatus: { in: ['PENDING', 'REJECTED'] }, verificationRequested: true },
        select: {
          id: true, slug: true, hexId: true, name: true, type: true, city: true, stateRegion: true, country: true,
          contactInfo: true, verificationNotes: true, verificationStatus: true, verificationSubmittedAt: true,
          verificationReviewedAt: true, hypeCount: true,
          owner: { select: { id: true, email: true, name: true, username: true, createdAt: true } }
        },
        orderBy: [{ verificationSubmittedAt: 'asc' }, { createdAt: 'asc' }]
      }) as unknown as Promise<VerificationProfile[]>,
      db.profile.count({ where: { verificationStatus: 'VERIFIED' } })
    ]);
  }

  // ── DUPLICATES ──
  let domainGroups: Array<{ domain: string; user_count: bigint }> = [];
  let profilesByName = new Map<string, Array<{ id: string; slug: string; name: string; type: string; createdAt: Date; owner: { id: string; email: string | null } | null }>>();

  if (tab === 'duplicates') {
    const [dg, ng] = await Promise.all([
      db.$queryRaw<Array<{ domain: string; user_count: bigint }>>`
        SELECT LOWER(SPLIT_PART(email, '@', 2)) AS domain, COUNT(*) AS user_count
        FROM "User" WHERE email IS NOT NULL
        GROUP BY domain HAVING COUNT(*) > 5 ORDER BY user_count DESC LIMIT 50`,
      db.$queryRaw<Array<{ name: string; profile_count: bigint }>>`
        SELECT LOWER(TRIM(name)) AS name, COUNT(*) AS profile_count
        FROM "Profile" GROUP BY LOWER(TRIM(name)) HAVING COUNT(*) > 1 ORDER BY profile_count DESC LIMIT 50`
    ]);
    domainGroups = dg;
    const duplicateNames = ng.map((g) => g.name);
    const duplicateProfiles = duplicateNames.length > 0
      ? await db.profile.findMany({
          where: { name: { in: duplicateNames, mode: 'insensitive' } },
          select: { id: true, slug: true, name: true, type: true, createdAt: true, owner: { select: { id: true, email: true } } },
          orderBy: { name: 'asc' }
        })
      : [];
    for (const p of duplicateProfiles) {
      const key = p.name.toLowerCase().trim();
      if (!profilesByName.has(key)) profilesByName.set(key, []);
      profilesByName.get(key)!.push(p);
    }
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px' }}>
      <h1 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: '1.75rem', letterSpacing: '-.02em', color: 'var(--ink)', marginBottom: 8 }}>{t('adminReviewPage.title', 'Review Queue')}</h1>

      <nav style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <Link href="/admin/review?tab=reports" className={`button small${tab === 'reports' ? '' : ' secondary'}`}>{t('adminReviewPage.tabReports', 'Reports')}</Link>
        <Link href="/admin/review?tab=verifications" className={`button small${tab === 'verifications' ? '' : ' secondary'}`}>{t('adminReviewPage.tabVerifications', 'Verifications')}</Link>
        <Link href="/admin/review?tab=duplicates" className={`button small${tab === 'duplicates' ? '' : ' secondary'}`}>{t('adminReviewPage.tabDuplicates', 'Duplicates')}</Link>
      </nav>

      {tab === 'reports' && (() => {
        const reportPages = Math.ceil(reportsTotal / REPORT_PAGE_SIZE);
        const rpHref = (overrides: Record<string, string>) => {
          const p = new URLSearchParams({ tab: 'reports', status: rStatus, ...(rType ? { type: rType } : {}), ...(resolved.from ? { from: resolved.from } : {}), ...(resolved.to ? { to: resolved.to } : {}), page: String(rPage), ...overrides });
          return `/admin/review?${p}`;
        };
        return (
        <>
          <form method="get" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, alignItems: 'flex-end' }}>
            <input type="hidden" name="tab" value="reports" />
            <select name="status" defaultValue={rStatus} className="input" style={{ width: 130 }}>
              <option value="OPEN">{t('adminReviewPage.statusOpen', 'Open')}</option>
              <option value="RESOLVED">{t('adminReviewPage.statusResolved', 'Resolved')}</option>
              <option value="DISMISSED">{t('adminReviewPage.statusDismissed', 'Dismissed')}</option>
            </select>
            <select name="type" defaultValue={rType} className="input" style={{ width: 130 }}>
              <option value="">{t('adminReviewPage.typeAll', 'All types')}</option>
              <option value="profile">{t('adminReviewPage.typeProfile', 'Profile')}</option>
              <option value="show">{t('adminReviewPage.typeShow', 'Show')}</option>
              <option value="comment">{t('adminReviewPage.typeComment', 'Comment')}</option>
              <option value="track">{t('adminReviewPage.typeTrack', 'Track')}</option>
            </select>
            <label style={{ display: 'grid', gap: 2 }}>
              <span className="meta" style={{ fontSize: '0.7813rem' }}>{t('adminReviewPage.from', 'From')}</span>
              <input className="input" type="date" name="from" defaultValue={resolved.from ?? ''} />
            </label>
            <label style={{ display: 'grid', gap: 2 }}>
              <span className="meta" style={{ fontSize: '0.7813rem' }}>{t('adminReviewPage.to', 'To')}</span>
              <input className="input" type="date" name="to" defaultValue={resolved.to ?? ''} />
            </label>
            <input type="hidden" name="page" value="1" />
            <button className="button small" type="submit">{t('adminReviewPage.filter', 'Filter')}</button>
            {(rStatus !== 'OPEN' || rType || resolved.from || resolved.to) && (
              <Link className="button small secondary" href="/admin/review?tab=reports">{t('adminReviewPage.reset', 'Reset')}</Link>
            )}
          </form>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <p style={{ fontFamily: 'var(--f-m)', fontSize: '0.8125rem', color: 'var(--ink-2)', margin: 0 }}>{reportsTotal} {rStatus.toLowerCase()} {reportsTotal !== 1 ? t('adminReviewPage.reportsPlural', 'reports') : t('adminReviewPage.reportSingular', 'report')}</p>
            {rStatus === 'OPEN' && reports.length > 0 && (
              <ReportPageBulkButtons ids={reports.map(r => r.id)} />
            )}
          </div>

          {reports.length === 0 ? (
            <p style={{ fontFamily: 'var(--f-m)', fontSize: '0.875rem', color: 'var(--ink-3)' }}>{t('adminReviewPage.noReports', 'No reports found.')}</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--f-m)', fontSize: '0.7813rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--line-2)', color: 'var(--ink-3)', letterSpacing: '.08em', textTransform: 'uppercase' }}>
                    <th style={thStyle}>{t('adminReviewPage.colDate', 'Date')}</th>
                    <th style={thStyle}>{t('adminReviewPage.colReason', 'Reason')}</th>
                    <th style={thStyle}>{t('adminReviewPage.colTargetType', 'Target type')}</th>
                    <th style={thStyle}>{t('adminReviewPage.colTarget', 'Target')}</th>
                    <th style={thStyle}>{t('adminReviewPage.colReporter', 'Reporter')}</th>
                    <th style={thStyle}>{t('adminReviewPage.colStatus', 'Status')}</th>
                    <th style={thStyle}>{t('adminReviewPage.colAction', 'Action')}</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map(r => {
                    const profile = r.targetType === 'profile' ? profileMap.get(r.targetId) : null;
                    const show = r.targetType === 'show' ? showMap.get(r.targetId) : null;
                    const comment = r.targetType === 'comment' ? commentMap.get(r.targetId) : null;
                    const entityHref = profile
                      ? (profile.type === 'VENUE' ? `/venues/${profile.slug}` : `/artists/${profile.slug}`)
                      : show ? `/shows/${show.slug}` : null;
                    const entityLabel = profile?.name ?? show?.title ?? (comment ? comment.content.slice(0, 60) + (comment.content.length > 60 ? '…' : '') : r.targetId);
                    return (
                      <tr key={r.id} style={{ borderBottom: '1px solid var(--line)' }}>
                        <td style={tdStyle}>{new Date(r.createdAt).toLocaleDateString()}</td>
                        <td style={tdStyle}>{r.reason}</td>
                        <td style={tdStyle}>{r.targetType}</td>
                        <td style={{ ...tdStyle, fontSize: '0.7813rem' }}>
                          {entityHref ? <Link href={entityHref} style={{ color: 'var(--accent)', textDecoration: 'none' }} target="_blank">{entityLabel}</Link> : <span style={{ fontFamily: 'monospace', fontSize: '0.7813rem', color: 'var(--ink-3)' }}>{entityLabel}</span>}
                        </td>
                        <td style={tdStyle}>{r.reporter ? <span title={r.reporter.email ?? ''}>{r.reporter.name ?? r.reporter.email}</span> : <span style={{ color: 'var(--ink-3)' }}>{t('adminReviewPage.anonymous', 'Anonymous')}</span>}</td>
                        <td style={tdStyle}>
                          <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.7813rem', letterSpacing: '.08em', background: r.status === 'OPEN' ? 'rgba(var(--accent-rgb),.15)' : 'rgba(var(--role-venue-rgb),.1)', color: r.status === 'OPEN' ? 'var(--accent)' : 'var(--role-venue)' }}>{r.status}</span>
                        </td>
                        <td style={tdStyle}>
                          {entityHref && <Link href={entityHref} target="_blank" style={{ fontFamily: 'var(--f-m)', fontSize: '0.7813rem', color: 'var(--ink-2)', textDecoration: 'none', marginRight: 8 }}>{t('adminReviewPage.viewLink', 'View ↗')}</Link>}
                          {r.status === 'OPEN' && <ResolveButton reportId={r.id} label={t('adminReviewPage.resolve', 'Resolve')} />}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {reportPages > 1 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 16, alignItems: 'center' }}>
              {rPage > 1 && <Link className="button small secondary" href={rpHref({ page: String(rPage - 1) })}>{t('adminReviewPage.prev', '← Prev')}</Link>}
              <span style={{ fontFamily: 'var(--f-m)', fontSize: '0.7813rem', color: 'var(--ink-3)' }}>{t('adminReviewPage.pageOf', 'Page')} {rPage} {t('adminReviewPage.of', 'of')} {reportPages}</span>
              {rPage < reportPages && <Link className="button small secondary" href={rpHref({ page: String(rPage + 1) })}>{t('adminReviewPage.next', 'Next →')}</Link>}
            </div>
          )}
        </>
        );
      })()}

      {tab === 'verifications' && (
        <div>
          <div className="panel" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <div className="badge">{t('adminReviewPage.adminBadge', 'Admin')}</div>
                <h2 style={{ margin: '0.5rem 0 0.25rem', fontSize: '1.5rem' }}>{t('adminReviewPage.verificationQueueTitle', 'Verification Queue')}</h2>
                <p className="meta">{t('adminReviewPage.verificationQueueDesc', 'Review artist and venue ownership claims.')}</p>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div className="stat" style={{ minWidth: '120px', textAlign: 'center' }}><strong>{pendingProfiles.filter(p => p.verificationStatus === 'PENDING').length}</strong><span>{t('adminReviewPage.pending', 'Pending')}</span></div>
                <div className="stat" style={{ minWidth: '120px', textAlign: 'center' }}><strong>{pendingProfiles.filter(p => p.verificationStatus === 'REJECTED').length}</strong><span>{t('adminReviewPage.rejected', 'Rejected')}</span></div>
                <div className="stat" style={{ minWidth: '120px', textAlign: 'center' }}><strong>{verifiedCount}</strong><span>{t('adminReviewPage.verifiedTotal', 'Verified total')}</span></div>
              </div>
            </div>
          </div>
          <AdminVerificationQueue profiles={pendingProfiles} />
        </div>
      )}

      {tab === 'duplicates' && (
        <>
          <h2 style={{ marginBottom: 8 }}>{t('adminReviewPage.domainConcentrationsTitle', 'Email domain concentrations')}</h2>
          <p className="meta">{t('adminReviewPage.domainConcentrationsDesc', 'Domains with more than 5 registered accounts:')}</p>
          {domainGroups.length === 0 ? <p className="meta">{t('adminReviewPage.noneFound', 'None found.')}</p> : (
            <table className="table" style={{ marginTop: 12, marginBottom: 32 }}>
              <thead><tr><th>{t('adminReviewPage.colDomain', 'Domain')}</th><th>{t('adminReviewPage.colAccounts', 'Accounts')}</th></tr></thead>
              <tbody>{domainGroups.map((row) => <tr key={row.domain}><td style={{ fontFamily: 'var(--font-jb, monospace)' }}>@{row.domain}</td><td>{Number(row.user_count)}</td></tr>)}</tbody>
            </table>
          )}
          <h2 style={{ marginBottom: 8 }}>{t('adminReviewPage.duplicateNamesTitle', 'Duplicate profile names')}</h2>
          <p className="meta">{t('adminReviewPage.duplicateNamesDesc', 'Profiles sharing the same name:')}</p>
          {profilesByName.size === 0 ? <p className="meta">{t('adminReviewPage.noneFound2', 'None found.')}</p> : (
            <div style={{ display: 'grid', gap: 16, marginTop: 12 }}>
              {[...profilesByName.entries()].map(([name, profiles]) => (
                <div key={name} className="panel" style={{ padding: '1rem' }}>
                  <h3 style={{ marginBottom: 8 }}>&ldquo;{profiles[0].name}&rdquo; — {profiles.length} {t('adminReviewPage.profilesLabel', 'profiles')}</h3>
                  <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 4 }}>
                    {profiles.map((p) => (
                      <li key={p.id} style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: '0.8125rem' }}>
                        <Link href={`/artists/${p.slug}`} target="_blank">{p.name}</Link>
                        <span className="badge" style={{ fontSize: '0.7813rem' }}>{p.type}</span>
                        <span className="meta">{p.owner?.email ?? t('adminReviewPage.noEmail', 'no email')}</span>
                        <span className="meta"><Link href={`/admin/users?q=${encodeURIComponent(p.owner?.id ?? '')}`}>{t('adminReviewPage.adminLink', 'admin')}</Link></span>
                        <span className="meta">{new Date(p.createdAt).toLocaleDateString()}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

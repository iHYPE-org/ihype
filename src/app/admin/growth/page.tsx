import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { isAdminSession } from '@/lib/permissions';
import { WORKBENCH_PATH } from '@/lib/auth-redirects';
import { db } from '@/lib/db';
import { getServerT } from '@/lib/i18n/server';
import { formatMetricValue } from '@/lib/analytics-engine';

export const metadata = {
  title: 'Growth | Admin | iHYPE',
  robots: { index: false, follow: false },
};

export default async function AdminGrowthPage() {
  const t = await getServerT();
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  if (!isAdminSession(session)) redirect(WORKBENCH_PATH);

  const [
    userCount,
    profileCount,
    artistsWithMedia,
    artistsWithShows,
    topHypedProfiles,
    funnelStage1,
    funnelStage2,
    funnelStage3,
    recentArtists,
  ] = await Promise.all([
    db.user.count().catch(() => null),
    db.profile.count().catch(() => null),
    db.profile.count({ where: { type: 'ARTIST', mediaUploads: { some: {} } } }).catch(() => null),
    db.profile.count({ where: { type: 'ARTIST', OR: [{ hostedShows: { some: {} } }, { headlinerShows: { some: {} } }] } }).catch(() => null),
    db.profile.findMany({
      orderBy: { hypeCount: 'desc' },
      take: 10,
      select: { name: true, slug: true, type: true, hypeCount: true },
    }).catch(() => []),
    db.profile.count({ where: { type: 'ARTIST', mediaUploads: { none: {} } } }).catch(() => null),
    db.profile.count({ where: { type: 'ARTIST', mediaUploads: { some: {} }, hostedShows: { none: {} }, headlinerShows: { none: {} } } }).catch(() => null),
    db.show.count({ where: { hypeCount: 0, status: { not: 'DRAFT' } } }).catch(() => null),
    db.profile.findMany({
      where: { type: 'ARTIST' },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { name: true, slug: true, createdAt: true, hypeCount: true },
    }).catch(() => []),
  ]);

  // `null` means the query failed and is rendered as an em dash. It must never
  // collapse to 0: on a funnel, a 0 is a finding ("nobody converted") and an
  // operator cannot tell it apart from a database that did not answer. This is
  // the same rule src/lib/analytics-engine.ts and admin-workbench.ts follow,
  // applied to the one admin surface that was still catching to zero.
  const funnelSteps = [
    { label: t('adminGrowthPage.totalUsers', 'Total users'), value: userCount },
    { label: t('adminGrowthPage.totalProfiles', 'Total profiles'), value: profileCount },
    { label: t('adminGrowthPage.artistsWithMedia', 'Artists with media'), value: artistsWithMedia },
    { label: t('adminGrowthPage.artistsWithShows', 'Artists with shows'), value: artistsWithShows },
  ];

  return (
    <div className="container section admin-console">
      <section className="panel admin-console-panel">
        <h1 style={{ fontSize: 20, marginBottom: 16 }}>{t('adminGrowthPage.title', 'Growth')}</h1>

        <h2 style={{ fontSize: 15, marginBottom: 10 }}>{t('adminGrowthPage.artistFunnelHeading', 'Artist Funnel')}</h2>
        <div className="admin-health-grid" style={{ marginBottom: 24 }}>
          {funnelSteps.map(({ label, value }) => (
            <div className="admin-health-card" key={label}>
              <span>{label}</span>
              <strong>{formatMetricValue(value, 'count')}</strong>
            </div>
          ))}
        </div>

        <h2 style={{ fontSize: 15, marginBottom: 10 }}>{t('adminGrowthPage.dropoffPointsHeading', 'Dropoff Points')}</h2>
        <div className="admin-health-grid" style={{ marginBottom: 24 }}>
          <div className="admin-health-card">
            <span>{t('adminGrowthPage.noUploadsYet', 'No uploads yet')}</span>
            <strong style={{ color: funnelStage1 && funnelStage1 > 0 ? 'var(--danger)' : 'inherit' }}>{formatMetricValue(funnelStage1, 'count')}</strong>
          </div>
          <div className="admin-health-card">
            <span>{t('adminGrowthPage.uploadsNoShows', 'Uploads, no shows')}</span>
            <strong style={{ color: funnelStage2 && funnelStage2 > 0 ? 'var(--warning-text)' : 'inherit' }}>{formatMetricValue(funnelStage2, 'count')}</strong>
          </div>
          <div className="admin-health-card">
            <span>{t('adminGrowthPage.showsWithZeroHypes', 'Shows with 0 hypes')}</span>
            <strong>{formatMetricValue(funnelStage3, 'count')}</strong>
          </div>
        </div>

        <h2 style={{ fontSize: 15, marginBottom: 10 }}>{t('adminGrowthPage.topHypedProfilesHeading', 'Top Hyped Profiles')}</h2>
        {!topHypedProfiles || topHypedProfiles.length === 0 ? (
          <div className="empty">{t('adminGrowthPage.noProfilesWithHypes', 'No profiles with hypes yet.')}</div>
        ) : (
          <div className="admin-list" style={{ marginBottom: 24 }}>
            {(topHypedProfiles ?? []).map(p => (
              <div className="admin-list-row" key={p.slug}>
                <span>{p.name}</span>
                <strong>{p.hypeCount} {t('adminGrowthPage.hypes', 'hypes')}</strong>
                <small>{p.type} · /{p.slug}</small>
              </div>
            ))}
          </div>
        )}

        <h2 style={{ fontSize: 15, marginBottom: 10 }}>{t('adminGrowthPage.recentArtistsHeading', 'Recent Artists')}</h2>
        {!recentArtists || recentArtists.length === 0 ? (
          <div className="empty">{t('adminGrowthPage.noArtistsYet', 'No artists yet.')}</div>
        ) : (
          <div className="admin-list">
            {(recentArtists ?? []).map(p => (
              <div className="admin-list-row" key={p.slug}>
                <span>{p.name}</span>
                <small>/{p.slug}</small>
                <small>{p.hypeCount} {t('adminGrowthPage.hypes', 'hypes')}</small>
                <small>{p.createdAt.toISOString().slice(0, 10)}</small>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

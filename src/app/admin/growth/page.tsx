import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { isAdminSession } from '@/lib/permissions';
import { WORKBENCH_PATH } from '@/lib/auth-redirects';
import { db } from '@/lib/db';

export const metadata = {
  title: 'Growth | Admin | iHYPE',
  robots: { index: false, follow: false },
};

export default async function AdminGrowthPage() {
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
    db.user.count().catch(() => 0),
    db.profile.count().catch(() => 0),
    db.profile.count({ where: { type: 'ARTIST', mediaUploads: { some: {} } } }).catch(() => 0),
    db.profile.count({ where: { type: 'ARTIST', OR: [{ hostedShows: { some: {} } }, { headlinerShows: { some: {} } }] } }).catch(() => 0),
    db.profile.findMany({
      orderBy: { hypeCount: 'desc' },
      take: 10,
      select: { name: true, slug: true, type: true, hypeCount: true },
    }).catch(() => []),
    db.profile.count({ where: { type: 'ARTIST', mediaUploads: { none: {} } } }).catch(() => 0),
    db.profile.count({ where: { type: 'ARTIST', mediaUploads: { some: {} }, hostedShows: { none: {} }, headlinerShows: { none: {} } } }).catch(() => 0),
    db.show.count({ where: { hypeCount: 0, status: { not: 'DRAFT' } } }).catch(() => 0),
    db.profile.findMany({
      where: { type: 'ARTIST' },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { name: true, slug: true, createdAt: true, hypeCount: true },
    }).catch(() => []),
  ]);

  const funnelSteps = [
    { label: 'Total users', value: userCount },
    { label: 'Total profiles', value: profileCount },
    { label: 'Artists with media', value: artistsWithMedia },
    { label: 'Artists with shows', value: artistsWithShows },
  ];

  return (
    <main className="container section admin-console">
      <section className="panel admin-console-panel">
        <h1 style={{ fontSize: 20, marginBottom: 16 }}>Growth</h1>

        <h2 style={{ fontSize: 15, marginBottom: 10 }}>Artist Funnel</h2>
        <div className="admin-health-grid" style={{ marginBottom: 24 }}>
          {funnelSteps.map(({ label, value }) => (
            <div className="admin-health-card" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>

        <h2 style={{ fontSize: 15, marginBottom: 10 }}>Dropoff Points</h2>
        <div className="admin-health-grid" style={{ marginBottom: 24 }}>
          <div className="admin-health-card">
            <span>No uploads yet</span>
            <strong style={{ color: funnelStage1 > 0 ? '#e74c3c' : 'inherit' }}>{funnelStage1}</strong>
          </div>
          <div className="admin-health-card">
            <span>Uploads, no shows</span>
            <strong style={{ color: funnelStage2 > 0 ? '#f39c12' : 'inherit' }}>{funnelStage2}</strong>
          </div>
          <div className="admin-health-card">
            <span>Shows with 0 hypes</span>
            <strong>{funnelStage3}</strong>
          </div>
        </div>

        <h2 style={{ fontSize: 15, marginBottom: 10 }}>Top Hyped Profiles</h2>
        {topHypedProfiles.length === 0 ? (
          <div className="empty">No profiles with hypes yet.</div>
        ) : (
          <div className="admin-list" style={{ marginBottom: 24 }}>
            {topHypedProfiles.map(p => (
              <div className="admin-list-row" key={p.slug}>
                <span>{p.name}</span>
                <strong>{p.hypeCount} hypes</strong>
                <small>{p.type} · /{p.slug}</small>
              </div>
            ))}
          </div>
        )}

        <h2 style={{ fontSize: 15, marginBottom: 10 }}>Recent Artists</h2>
        {recentArtists.length === 0 ? (
          <div className="empty">No artists yet.</div>
        ) : (
          <div className="admin-list">
            {recentArtists.map(p => (
              <div className="admin-list-row" key={p.slug}>
                <span>{p.name}</span>
                <small>/{p.slug}</small>
                <small>{p.hypeCount} hypes</small>
                <small>{p.createdAt.toISOString().slice(0, 10)}</small>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

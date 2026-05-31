import { BulkActions } from '@/components/admin/BulkActions';
import { SocialPostCopy } from '@/components/admin/SocialPostCopy';
import { FeatureToggle } from '@/components/admin/FeatureToggle';

interface Props {
  funnelStage1: number;
  funnelStage2: number;
  funnelStage3: number;
  funnelStage1Recent: Array<{ name: string | null; slug: string; createdAt: Date }>;
  recentSocialPosts: Array<{ id: string; text: string; generatedAt: Date }>;
  calendarShows: Array<{
    id: string;
    title: string;
    startsAt: Date;
    featured: boolean;
    venueProfile: { name: string } | null;
    headlinerProfile: { name: string } | null;
    ticketsSoldCount: number;
    ticketCapacity: number | null;
  }>;
}

export function TabDashboardArtistFunnel({
  funnelStage1,
  funnelStage2,
  funnelStage3,
  funnelStage1Recent,
  recentSocialPosts,
  calendarShows,
}: Props) {
  return (
    <>
      {/* Artist Funnel */}
      <section className="panel admin-console-panel">
        <div className="admin-console-panel-head">
          <div>
            <h2>Artist Funnel</h2>
            <p className="meta">Where artists drop off before their first show.</p>
          </div>
        </div>
        <div className="admin-health-grid">
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
        {funnelStage1Recent.length > 0 && (
          <div className="admin-list" style={{ marginTop: 12 }}>
            <strong style={{ fontSize: 13, marginBottom: 6, display: 'block' }}>Recent stage-1 artists (no uploads)</strong>
            {funnelStage1Recent.map((p) => (
              <div className="admin-list-row" key={p.slug}>
                <span>{p.name}</span>
                <small>{p.slug} · joined {p.createdAt.toISOString().slice(0, 10)}</small>
              </div>
            ))}
          </div>
        )}
        <BulkActions
          items={funnelStage1Recent.map((p) => ({ id: p.slug, label: p.name ?? p.slug }))}
          type="profiles"
        />
      </section>

      {/* Social Posts */}
      <section className="panel admin-console-panel">
        <div className="admin-console-panel-head">
          <div>
            <h2>Social Posts</h2>
            <p className="meta">Recent auto-generated social digest posts.</p>
          </div>
        </div>
        {recentSocialPosts.length === 0 ? (
          <div className="empty">No social posts yet. Monday digest will generate them.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {recentSocialPosts.map((post) => (
              <div key={post.id} style={{ background: 'var(--bg2,#111)', border: '1px solid var(--line2,#333)', borderRadius: 8, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <pre style={{ fontFamily: 'inherit', fontSize: 13, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{post.text}</pre>
                  <small style={{ color: 'var(--ink3,#666)', fontSize: 11 }}>{post.generatedAt.toISOString().slice(0, 16)}</small>
                </div>
                <SocialPostCopy text={post.text} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Content Calendar */}
      <section className="panel admin-console-panel">
        <div className="admin-console-panel-head">
          <div>
            <h2>Upcoming Calendar</h2>
            <p className="meta">Scheduled shows in the next 30 days.</p>
          </div>
        </div>
        {calendarShows.length === 0 ? (
          <div className="empty">No scheduled shows in the next 30 days.</div>
        ) : (
          <div>
            {Object.entries(
              calendarShows.reduce((acc: Record<string, typeof calendarShows>, show) => {
                const date = show.startsAt.toLocaleDateString();
                acc[date] ??= [];
                acc[date].push(show);
                return acc;
              }, {})
            ).map(([date, shows]) => (
              <div key={date} style={{ marginBottom: 14 }}>
                <div style={{ fontFamily: 'var(--f-mono,monospace)', fontSize: 12, fontWeight: 700, color: 'var(--ink3,#666)', marginBottom: 6, letterSpacing: '.08em', textTransform: 'uppercase' }}>{date}</div>
                {shows.map((show) => (
                  <div key={show.id} className="admin-list-row" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ flex: 1 }}>{show.title}</span>
                    <small>{show.venueProfile?.name ?? '—'}</small>
                    <small>{show.headlinerProfile?.name ?? '—'}</small>
                    <small>{show.ticketsSoldCount}/{show.ticketCapacity ?? '∞'} tix</small>
                    <FeatureToggle showId={show.id} initialFeatured={show.featured} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

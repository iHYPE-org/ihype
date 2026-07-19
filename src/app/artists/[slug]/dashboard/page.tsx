import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { canManageOwnedResource } from '@/lib/permissions';
import { getProfileInsights } from '@/lib/profile-insights';
import { getArtistDashboardStats } from '@/lib/artist-dashboard';
import { formatCurrencyFromCents } from '@/lib/ticketing';
import { getDemoCreatorExclusion } from '@/lib/runtime-flags';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const profile = await db.profile.findUnique({ where: { slug }, select: { name: true } });
  return {
    title: profile ? `Dashboard · ${profile.name} · iHYPE` : 'Artist Dashboard · iHYPE',
    robots: { index: false, follow: false },
  };
}

function fmtDate(d: Date) {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export default async function ArtistDashboardPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  const { slug } = await params;

  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/artists/${slug}/dashboard`);
  }

  const profile = await db.profile.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true, ownerId: true, type: true },
  });
  if (!profile || profile.type !== 'ARTIST') return notFound();

  const isOwner = canManageOwnedResource(session, profile.ownerId);
  if (!isOwner) return notFound();

  const [insights, dashStats, shows] = await Promise.all([
    getProfileInsights(profile.id, profile.type),
    getArtistDashboardStats(profile.id),
    db.show.findMany({
      where: { headlinerProfileId: profile.id, ...getDemoCreatorExclusion() },
      select: {
        slug: true, title: true, startsAt: true, status: true,
        isTicketed: true, ticketsSoldCount: true, ticketCapacity: true,
        venueProfile: { select: { name: true, city: true } },
      },
      orderBy: { startsAt: 'asc' },
    }),
  ]);

  const now = new Date();
  const upcomingShows = shows.filter((s) => s.status === 'LIVE' || s.startsAt >= now).slice(0, 8);

  const bookingPending = insights.bookingRequests.pending;

  // Activity feed: a small, real set of recent signals — not the mockup's
  // fabricated line items. Each row only renders if its underlying count is
  // actually nonzero.
  const activity: { color: string; text: React.ReactNode }[] = [];
  if (dashStats.hypesThisWeek > 0) {
    activity.push({
      color: 'var(--accent)',
      text: <><strong>{dashStats.hypesThisWeek.toLocaleString()}</strong> fan{dashStats.hypesThisWeek === 1 ? '' : 's'} hyped your profile this week</>,
    });
  }
  if (dashStats.ticketsSoldThisWeek > 0) {
    activity.push({
      color: 'var(--role-venue, #22e5d4)',
      text: <><strong>{dashStats.ticketsSoldThisWeek.toLocaleString()}</strong> ticket{dashStats.ticketsSoldThisWeek === 1 ? '' : 's'} sold this week</>,
    });
  }
  if (bookingPending > 0) {
    activity.push({
      color: '#b983ff',
      text: <><strong>{bookingPending.toLocaleString()}</strong> pending booking request{bookingPending === 1 ? '' : 's'} awaiting a reply</>,
    });
  }

  return (
    <div className="ad-page">
      <div className="ad-header">
        <div>
          <div className="ad-eyebrow">Welcome back</div>
          <h1 className="ad-title">{profile.name}</h1>
        </div>
        <div className="ad-header-actions">
          <Link className="ad-btn ad-btn-solid" href="/events/new">+ Create Event</Link>
        </div>
      </div>

      <div className="ad-stats-grid">
        <Link className="ad-stat-card" href={`/artists/${profile.slug}?section=insights`}>
          <div className="ad-stat-label">This Month</div>
          <div className="ad-stat-val" style={{ color: 'var(--accent)' }}>{formatCurrencyFromCents(dashStats.monthEarningsCents)}</div>
          <div className="ad-stat-sub">Your 70% share · $0 iHYPE fee</div>
        </Link>
        <div className="ad-stat-card">
          <div className="ad-stat-label">Tickets Sold</div>
          <div className="ad-stat-val">{dashStats.ticketsSoldThisMonth.toLocaleString()}</div>
          <div className="ad-stat-sub">This month</div>
        </div>
        <div className="ad-stat-card">
          <div className="ad-stat-label">Hype Cast</div>
          <div className="ad-stat-val">{insights.hypeTotal.toLocaleString()}</div>
          <div className="ad-stat-sub">Total hypes</div>
        </div>
        <div className="ad-stat-card">
          <div className="ad-stat-label">Next Payout</div>
          <div className="ad-stat-val">{dashStats.nextPayoutAt ? fmtDate(dashStats.nextPayoutAt) : '—'}</div>
          <div className="ad-stat-sub">{dashStats.nextPayoutAt ? 'Released after show ends' : 'No pending payout'}</div>
        </div>
      </div>

      <div className="ad-columns">
        <div>
          <div className="ad-section-head">
            <span className="ad-eyebrow-sm">Upcoming Events</span>
          </div>
          {upcomingShows.length === 0 ? (
            <div className="ad-empty"><p>No upcoming events — create one to get started.</p></div>
          ) : (
            <div className="ad-events-list">
              {upcomingShows.map((show) => (
                <Link className="ad-event-row" href={`/shows/${show.slug}`} key={show.slug}>
                  <div style={{ minWidth: 0 }}>
                    <div className="ad-event-title">{show.title}</div>
                    <div className="ad-event-meta">
                      {fmtDate(show.startsAt)}
                      {show.venueProfile?.name ? ` · ${show.venueProfile.name}` : ''}
                      {show.isTicketed && show.ticketCapacity ? ` · ${(show.ticketsSoldCount ?? 0).toLocaleString()} / ${show.ticketCapacity.toLocaleString()} sold` : ''}
                    </div>
                  </div>
                  <span className="ad-pill">{show.status === 'LIVE' ? 'Live' : 'On sale'}</span>
                </Link>
              ))}
            </div>
          )}

          <div className="ad-section-head" style={{ marginTop: 28 }}>
            <span className="ad-eyebrow-sm">Activity</span>
          </div>
          {activity.length === 0 ? (
            <div className="ad-empty"><p>No activity yet.</p></div>
          ) : (
            <div className="ad-activity-list">
              {activity.map((item, i) => (
                <div className="ad-activity-row" key={i}>
                  <span className="ad-activity-dot" style={{ background: item.color }} />
                  <div className="ad-activity-text">{item.text}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="ad-section-head"><span className="ad-eyebrow-sm">Quick Actions</span></div>
          <div className="ad-actions-list">
            <Link className="ad-btn ad-btn-outline ad-btn-full" href={`/artists/${profile.slug}?section=tracks`}>Upload a track</Link>
            <Link className="ad-btn ad-btn-outline ad-btn-full" href={`/artists/${profile.slug}?section=insights`}>View analytics</Link>
            <Link className="ad-btn ad-btn-outline ad-btn-full" href={`/artists/${profile.slug}`}>Edit my page</Link>
          </div>
        </div>
      </div>

      <style>{`
        .ad-page { max-width: 1000px; margin: 0 auto; padding: 40px 24px 100px; }
        .ad-header { display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 16px; margin-bottom: 28px; }
        .ad-eyebrow { font-family: var(--font-mono); font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: var(--ink-a50); margin-bottom: 6px; }
        .ad-title { font-family: var(--font-display); font-size: 28px; font-weight: 800; letter-spacing: -.02em; margin: 0; color: var(--ink); }
        .ad-header-actions { display: flex; gap: 10px; }
        .ad-btn { display: inline-flex; align-items: center; justify-content: center; text-decoration: none; padding: 10px 20px; border-radius: var(--radius-md); font-size: 13px; font-weight: 700; min-height: 44px; }
        .ad-btn-solid { background: var(--accent); color: #fff; }
        .ad-btn-outline { background: transparent; color: var(--ink); border: 1px solid var(--line-2); }
        .ad-btn-outline:hover { background: var(--line); }
        .ad-btn-full { width: 100%; }
        .ad-stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 32px; }
        .ad-stat-card { display: block; text-decoration: none; color: inherit; padding: 18px 20px; border-radius: var(--radius-lg); border: 1px solid var(--line); background: var(--bg2); }
        .ad-stat-label { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: .14em; color: var(--ink-a50); margin-bottom: 6px; }
        .ad-stat-val { font-family: var(--font-display); font-weight: 800; font-size: 24px; color: var(--ink); }
        .ad-stat-sub { font-size: 11.5px; color: var(--ink-a50); margin-top: 2px; }
        .ad-columns { display: grid; grid-template-columns: 1fr 320px; gap: 20px; }
        .ad-section-head { display: flex; justify-content: space-between; align-items: baseline; }
        .ad-eyebrow-sm { font-family: var(--font-mono); font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: var(--ink-a50); }
        .ad-empty { text-align: center; padding: 40px 24px; color: var(--ink-a50); border: 1px solid var(--line); border-radius: var(--radius-md); background: var(--bg2); margin-top: 12px; }
        .ad-events-list { border: 1px solid var(--line); border-radius: var(--radius-md); background: var(--bg2); margin-top: 12px; overflow: hidden; }
        .ad-event-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 16px 20px; border-bottom: 1px solid var(--line); text-decoration: none; color: inherit; }
        .ad-event-row:last-child { border-bottom: none; }
        .ad-event-row:hover { background: var(--bg3); }
        .ad-event-title { font-family: var(--font-display); font-weight: 800; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ad-event-meta { font-size: 12px; color: var(--ink-a55); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ad-pill { flex-shrink: 0; font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: .1em; padding: 5px 10px; border-radius: var(--radius-pill); background: rgba(34,229,212,.15); color: var(--role-venue, #22e5d4); }
        .ad-activity-list { display: flex; flex-direction: column; gap: 2px; margin-top: 12px; }
        .ad-activity-row { display: flex; gap: 12px; align-items: flex-start; padding: 12px 0; border-bottom: 1px solid var(--line); }
        .ad-activity-row:last-child { border-bottom: none; }
        .ad-activity-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; margin-top: 6px; }
        .ad-activity-text { font-size: 13px; color: var(--ink-a80); }
        .ad-actions-list { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }

        @media (max-width: 760px) {
          .ad-columns { grid-template-columns: 1fr; }
        }
        @media (max-width: 600px) {
          .ad-page { padding: 28px 20px 100px; }
        }
      `}</style>
    </div>
  );
}

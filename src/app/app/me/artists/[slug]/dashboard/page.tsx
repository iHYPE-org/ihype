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
import { getServerT } from '@/lib/i18n/server';

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
  const t = await getServerT();
  const { slug } = await params;

  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/app/me/artists/${slug}/dashboard`);
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
      color: 'var(--accent-text)',
      text: <><strong>{dashStats.hypesThisWeek.toLocaleString()}</strong> {dashStats.hypesThisWeek === 1 ? t('artistsSlugDashboardPage.fanHypedSingular', 'fan hyped your profile this week') : t('artistsSlugDashboardPage.fanHypedPlural', 'fans hyped your profile this week')}</>,
    });
  }
  if (dashStats.ticketsSoldThisWeek > 0) {
    activity.push({
      color: 'var(--role-venue)',
      text: <><strong>{dashStats.ticketsSoldThisWeek.toLocaleString()}</strong> {dashStats.ticketsSoldThisWeek === 1 ? t('artistsSlugDashboardPage.ticketSoldSingular', 'ticket sold this week') : t('artistsSlugDashboardPage.ticketSoldPlural', 'tickets sold this week')}</>,
    });
  }
  if (bookingPending > 0) {
    activity.push({
      color: 'var(--role-fan)',
      text: <><strong>{bookingPending.toLocaleString()}</strong> {bookingPending === 1 ? t('artistsSlugDashboardPage.pendingBookingSingular', 'pending booking request awaiting a reply') : t('artistsSlugDashboardPage.pendingBookingPlural', 'pending booking requests awaiting a reply')}</>,
    });
  }

  return (
    <div className="ad-page">
      <div className="ad-header">
        <div>
          <div className="ad-eyebrow">{t('artistsSlugDashboardPage.welcomeBack', 'Welcome back')}</div>
          <h1 className="ad-title">{profile.name}</h1>
        </div>
        <div className="ad-header-actions">
          <Link className="ad-btn ad-btn-solid" href="/app/me/events/new">{t('artistsSlugDashboardPage.createEvent', '+ Create Event')}</Link>
        </div>
      </div>

      <div className="ad-stats-grid">
        <Link className="ad-stat-card" href={`/app/me/artists/${profile.slug}/analytics`}>
          <div className="ad-stat-label">{t('artistsSlugDashboardPage.thisMonthLabel', 'This Month')}</div>
          <div className="ad-stat-val" style={{ color: 'var(--accent-text)' }}>{formatCurrencyFromCents(dashStats.monthEarningsCents)}</div>
          <div className="ad-stat-sub">{t('artistsSlugDashboardPage.yourShare', 'Your 70% share · $0 iHYPE fee')}</div>
        </Link>
        <div className="ad-stat-card">
          <div className="ad-stat-label">{t('artistsSlugDashboardPage.ticketsSoldLabel', 'Tickets Sold')}</div>
          <div className="ad-stat-val">{dashStats.ticketsSoldThisMonth.toLocaleString()}</div>
          <div className="ad-stat-sub">{t('artistsSlugDashboardPage.thisMonth', 'This month')}</div>
        </div>
        <div className="ad-stat-card">
          <div className="ad-stat-label">{t('artistsSlugDashboardPage.hypeCastLabel', 'Hype Cast')}</div>
          <div className="ad-stat-val">{insights.hypeTotal.toLocaleString()}</div>
          <div className="ad-stat-sub">{t('artistsSlugDashboardPage.totalHypes', 'Total hypes')}</div>
        </div>
        <div className="ad-stat-card">
          <div className="ad-stat-label">{t('artistsSlugDashboardPage.nextPayoutLabel', 'Next Payout')}</div>
          <div className="ad-stat-val">{dashStats.nextPayoutAt ? fmtDate(dashStats.nextPayoutAt) : '—'}</div>
          <div className="ad-stat-sub">{dashStats.nextPayoutAt ? t('artistsSlugDashboardPage.releasedAfterShow', 'Released after show ends') : t('artistsSlugDashboardPage.noPendingPayout', 'No pending payout')}</div>
        </div>
      </div>

      <div className="ad-columns">
        <div>
          <div className="ad-section-head">
            <span className="ad-eyebrow-sm">{t('artistsSlugDashboardPage.upcomingEvents', 'Upcoming Events')}</span>
          </div>
          {upcomingShows.length === 0 ? (
            <div className="ad-empty"><p>{t('artistsSlugDashboardPage.noUpcomingEvents', 'No upcoming events — create one to get started.')}</p></div>
          ) : (
            <div className="ad-events-list">
              {upcomingShows.map((show) => (
                <Link className="ad-event-row" href={show.status === 'DRAFT' ? `/app/me/shows/${show.slug}/lineup` : `/app/shows/${show.slug}`} key={show.slug}>
                  <div style={{ minWidth: 0 }}>
                    <div className="ad-event-title">{show.title}</div>
                    <div className="ad-event-meta">
                      {fmtDate(show.startsAt)}
                      {show.venueProfile?.name ? ` · ${show.venueProfile.name}` : ''}
                      {show.status === 'DRAFT'
                        ? ` · ${t('artistsSlugDashboardPage.draftReviewSplit', 'Draft — review lineup split')}`
                        : show.isTicketed && show.ticketCapacity
                          ? ` · ${(show.ticketsSoldCount ?? 0).toLocaleString()} / ${show.ticketCapacity.toLocaleString()} ${t('artistsSlugDashboardPage.sold', 'sold')}`
                          : ''}
                    </div>
                  </div>
                  <span className="ad-pill">{show.status === 'LIVE' ? t('artistsSlugDashboardPage.live', 'Live') : show.status === 'DRAFT' ? t('artistsSlugDashboardPage.draft', 'Draft') : t('artistsSlugDashboardPage.onSale', 'On sale')}</span>
                </Link>
              ))}
            </div>
          )}

          <div className="ad-section-head" style={{ marginTop: 28 }}>
            <span className="ad-eyebrow-sm">{t('artistsSlugDashboardPage.activity', 'Activity')}</span>
          </div>
          {activity.length === 0 ? (
            <div className="ad-empty"><p>{t('artistsSlugDashboardPage.noActivity', 'No activity yet.')}</p></div>
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
          <div className="ad-section-head"><span className="ad-eyebrow-sm">{t('artistsSlugDashboardPage.quickActions', 'Quick Actions')}</span></div>
          <div className="ad-actions-list">
            <Link className="ad-btn ad-btn-outline ad-btn-full" href="/app/me/profiles">{t('artistsSlugDashboardPage.uploadTrack', 'Upload a track')}</Link>
            <Link className="ad-btn ad-btn-outline ad-btn-full" href={`/app/me/artists/${profile.slug}/analytics`}>{t('artistsSlugDashboardPage.viewAnalytics', 'View analytics')}</Link>
            <Link className="ad-btn ad-btn-outline ad-btn-full" href="/app/me/profiles">{t('artistsSlugDashboardPage.editMyPage', 'Edit my page')}</Link>
          </div>
        </div>
      </div>

      <style>{`
        .ad-page { max-width: 1000px; margin: 0 auto; padding: 40px 24px 100px; }
        .ad-header { display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 16px; margin-bottom: 28px; }
        .ad-eyebrow { font-family: var(--font-mono); font-size: 0.6875rem; letter-spacing: .14em; text-transform: uppercase; color: var(--ink-a65); margin-bottom: 6px; }
        .ad-title { font-family: var(--font-display); font-size: 1.75rem; font-weight: 800; letter-spacing: -.02em; margin: 0; color: var(--ink); }
        .ad-header-actions { display: flex; gap: 10px; }
        .ad-btn { display: inline-flex; align-items: center; justify-content: center; text-decoration: none; padding: 10px 20px; border-radius: var(--radius-md); font-size: 0.9375rem; font-weight: 700; min-height: 44px; }
        .ad-btn-solid { background: var(--accent); color: var(--ink-on-accent); }
        .ad-btn-outline { background: transparent; color: var(--ink); border: 1px solid var(--line-2); }
        .ad-btn-outline:hover { background: var(--line); }
        .ad-btn-full { width: 100%; }
        .ad-stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 32px; }
        .ad-stat-card { display: block; text-decoration: none; color: inherit; padding: 18px 20px; border-radius: var(--radius-lg); border: 1px solid var(--line); background: var(--bg2); }
        .ad-stat-label { font-family: var(--font-mono); font-size: 0.6875rem; text-transform: uppercase; letter-spacing: .14em; color: var(--ink-a65); margin-bottom: 6px; }
        .ad-stat-val { font-family: var(--font-display); font-weight: 800; font-size: 1.5rem; color: var(--ink); }
        .ad-stat-sub { font-size: 0.9375rem; color: var(--ink-a65); margin-top: 2px; }
        /* minmax(0, …), not 1fr: a bare 1fr floors at MIN-CONTENT, so one long
           unbreakable token — a venue name, a URL — pushes this column past its
           share and scrolls the page sideways above the breakpoint below. */
        .ad-columns { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 20px; }
        .ad-section-head { display: flex; justify-content: space-between; align-items: baseline; }
        .ad-eyebrow-sm { font-family: var(--font-mono); font-size: 0.9375rem; letter-spacing: .12em; text-transform: uppercase; color: var(--ink-a65); }
        .ad-empty { text-align: center; padding: 40px 24px; color: var(--ink-a65); border: 1px solid var(--line); border-radius: var(--radius-md); background: var(--bg2); margin-top: 12px; }
        .ad-events-list { border: 1px solid var(--line); border-radius: var(--radius-md); background: var(--bg2); margin-top: 12px; overflow: hidden; }
        .ad-event-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 16px 20px; border-bottom: 1px solid var(--line); text-decoration: none; color: inherit; }
        .ad-event-row:last-child { border-bottom: none; }
        .ad-event-row:hover { background: var(--bg3); }
        .ad-event-title { font-family: var(--font-display); font-weight: 800; font-size: 0.9375rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ad-event-meta { font-size: 0.9375rem; color: var(--ink-a65); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ad-pill { flex-shrink: 0; font-family: var(--font-mono); font-size: 0.9375rem; text-transform: uppercase; letter-spacing: .1em; padding: 5px 10px; border-radius: var(--radius-pill); background: rgba(var(--role-venue-rgb),.15); color: var(--role-venue); }
        .ad-activity-list { display: flex; flex-direction: column; gap: 2px; margin-top: 12px; }
        .ad-activity-row { display: flex; gap: 12px; align-items: flex-start; padding: 12px 0; border-bottom: 1px solid var(--line); }
        .ad-activity-row:last-child { border-bottom: none; }
        .ad-activity-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; margin-top: 6px; }
        .ad-activity-text { font-size: 0.9375rem; color: var(--ink-a80); }
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

import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getPromoterDashboard } from '@/lib/promoterDashboard';
import { formatCurrencyFromCents } from '@/lib/ticketing';
import { getServerT } from '@/lib/i18n/server';
import { NotificationsList } from '@/components/NotificationsList';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Dashboard · iHYPE',
  robots: { index: false, follow: false },
};

type ActivityItem = {
  id: string;
  color: string;
  text: React.ReactNode;
  at: Date;
};

export default async function FanDashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?callbackUrl=/me/dashboard');

  const notifications = await db.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { id: true, type: true, body: true, read: true, link: true, createdAt: true },
  });

  const t = await getServerT();
  const userId = session.user.id;
  const now = new Date();

  const [user, hypeCastCount, recentHypes, upcomingOrders, ownFanProfile, promoterDashboard] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { username: true, name: true } }),
    // Real count of Hype rows cast by this user (HypeEvent.userId) — "Hype Cast" stat.
    db.hypeEvent.count({ where: { userId } }),
    db.hypeEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: {
        id: true,
        createdAt: true,
        show: { select: { title: true, slug: true, headlinerProfile: { select: { name: true } } } },
      },
    }),
    // Same real ticket-order query pattern as src/app/tickets/page.tsx.
    db.ticketOrder.findMany({
      where: { buyerUserId: userId, status: { not: 'VOID' }, show: { startsAt: { gte: now } } },
      orderBy: { show: { startsAt: 'asc' } },
      take: 10,
      select: {
        id: true,
        show: { select: { slug: true, title: true, startsAt: true, venueProfile: { select: { name: true } } } },
      },
    }),
    db.profile.findFirst({ where: { ownerId: userId, type: 'LISTENER' }, select: { slug: true } }),
    // Reuses the real promoter/referral dashboard — earnedCents is exactly the
    // "Referral Earned" stat, already computed from live TicketOrder rows.
    getPromoterDashboard(userId),
  ]);

  // Most recent real referral conversion (a ticket order driven by this user's
  // own profiles' affiliate link), for the activity feed.
  const ownProfileIds = await db.profile.findMany({ where: { ownerId: userId }, select: { id: true } });
  const recentReferralOrder = ownProfileIds.length
    ? await db.ticketOrder.findFirst({
        where: {
          affiliatePromoterProfileId: { in: ownProfileIds.map((p) => p.id) },
          status: { in: ['CAPTURED', 'RESERVED'] },
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true, createdAt: true, promoterPayoutCents: true, show: { select: { title: true } } },
      })
    : null;

  const upcomingShows = upcomingOrders.map((o) => o.show);
  const nextShow = upcomingShows[0] ?? null;

  const activity: ActivityItem[] = [
    ...recentHypes.map((h) => ({
      id: `hype-${h.id}`,
      color: 'var(--role-fan)',
      text: (
        <>
          {t('meDashboardPage.youHyped', 'You hyped')} <strong style={{ color: 'var(--ink)' }}>{h.show.title}</strong>
          {h.show.headlinerProfile?.name ? ` ${t('meDashboardPage.byArtist', 'by')} ${h.show.headlinerProfile.name}` : ''}
        </>
      ),
      at: h.createdAt,
    })),
    ...(recentReferralOrder
      ? [
          {
            id: `ref-${recentReferralOrder.id}`,
            color: 'var(--role-venue)',
            text: (
              <>
                {t('meDashboardPage.someoneBoughtTicketTo', 'Someone bought a ticket to')} <strong style={{ color: 'var(--ink)' }}>{recentReferralOrder.show.title}</strong> {t('meDashboardPage.viaYourHypeLink', 'via your HYPE Link')} —{' '}
                <strong style={{ color: 'var(--ink)' }}>+{formatCurrencyFromCents(recentReferralOrder.promoterPayoutCents)}</strong>
              </>
            ),
            at: recentReferralOrder.createdAt,
          },
        ]
      : []),
    // NOTE: "recently-followed DJ went live" was omitted — there is no cheap
    // existing query (e.g. a Follow → Profile → live-Show join) wired up
    // anywhere else in the codebase to reuse, and building one is out of
    // scope for this page. Fail honestly rather than fabricate.
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 5);

  const displayName = user?.name || user?.username || 'there';

  return (
    <div className="fan-dash-container">
      <div className="fan-dash-header">
        <div>
          <div className="fan-dash-eyebrow">{t('meDashboardPage.welcomeBack', 'Welcome back')}, {displayName}</div>
          <h1>{t('meDashboardPage.sceneAmplified', 'Your scene, amplified.')}</h1>
          <p className="fan-dash-intro">{t('meDashboardPage.intro', 'Everything you HYPE, attend, share, and discover becomes part of the signal.')}</p>
        </div>
        <div className="fan-dash-header-actions">
          {/* Discover, which is `/app/music/discover` since row 273 — the tab
              that carries the SEEDS badge in the nav registry. This pointed at
              `/listen?tab=seeds` and was a second way into the legacy deck. */}
          <Link className="ihype-btn-outline" href="/app/music/discover">{t('meDashboardPage.startSeed', 'Start Seed')}</Link>
        </div>
      </div>

      <div className="fan-dash-stats">
        {/* NOTE: no "Listening Streak" card — nothing in the schema tracks daily
            listen streaks (no field/model for it). Per this codebase's
            convention, that card is omitted rather than fabricated. */}
        <Link className="fan-dash-stat-card" href="/tickets">
          <div className="fan-dash-stat-label">{t('meDashboardPage.hypeCastLabel', 'Hype Cast')}</div>
          <div className="fan-dash-stat-value">{hypeCastCount}</div>
          <div className="fan-dash-stat-sub">{t('meDashboardPage.showsYouveHyped', 'Shows you’ve hyped')}</div>
        </Link>
        <div className="fan-dash-stat-card">
          <div className="fan-dash-stat-label">{t('meDashboardPage.referralEarnedLabel', 'Referral Earned')}</div>
          <div className="fan-dash-stat-value" style={{ color: 'var(--role-fan)' }}>
            {formatCurrencyFromCents(promoterDashboard.earnedCents)}
          </div>
          <div className="fan-dash-stat-sub">{t('meDashboardPage.referralEarnedSub', 'From your HYPE Link (pending settlement)')}</div>
        </div>
        <div className="fan-dash-stat-card">
          <div className="fan-dash-stat-label">{t('meDashboardPage.nextShowLabel', 'Next Show')}</div>
          {nextShow ? (
            <>
              <div className="fan-dash-stat-value">
                {nextShow.startsAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </div>
              <div className="fan-dash-stat-sub">
                {nextShow.title}{nextShow.venueProfile?.name ? ` @ ${nextShow.venueProfile.name}` : ''}
              </div>
            </>
          ) : (
            <>
              <div className="fan-dash-stat-value">—</div>
              <div className="fan-dash-stat-sub">{t('meDashboardPage.noUpcomingTickets', 'No upcoming tickets')}</div>
            </>
          )}
        </div>
      </div>

      <div className="fan-dash-grid">
        <div>
          <div className="fan-dash-section-head">
            <span className="fan-dash-eyebrow-sm">{t('meDashboardPage.upcomingShows', 'Upcoming Shows')}</span>
          </div>
          {upcomingShows.length === 0 ? (
            <div className="fan-dash-empty">
              <p>{t('meDashboardPage.noUpcomingShows', 'No upcoming shows — find one to attend.')}</p>
            </div>
          ) : (
            <div className="fan-dash-show-list">
              {upcomingShows.map((show) => (
                <Link className="fan-dash-show-row" href={`/shows/${show.slug}`} key={show.slug}>
                  <div>
                    <div className="fan-dash-show-title">{show.title}{show.venueProfile?.name ? ` @ ${show.venueProfile.name}` : ''}</div>
                    <div className="fan-dash-show-meta">
                      {show.startsAt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} ·{' '}
                      {show.startsAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </div>
                  </div>
                  <span className="fan-dash-pill">{t('meDashboardPage.attendingPill', 'Attending')}</span>
                </Link>
              ))}
            </div>
          )}

          <div className="fan-dash-section-head" style={{ marginTop: 28 }}>
            <span className="fan-dash-eyebrow-sm">{t('meDashboardPage.activity', 'Activity')}</span>
          </div>
          {activity.length === 0 ? (
            <div className="fan-dash-empty"><p>{t('meDashboardPage.noActivityYet', 'No activity yet.')}</p></div>
          ) : (
            <div className="fan-dash-activity-list">
              {activity.map((item) => (
                <div className="fan-dash-activity-row" key={item.id}>
                  <span className="fan-dash-activity-dot" style={{ background: item.color }} />
                  <div className="fan-dash-activity-text">{item.text}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="fan-dash-section-head">
            <span className="fan-dash-eyebrow-sm">{t('meDashboardPage.quickActions', 'Quick Actions')}</span>
          </div>
          <div className="fan-dash-actions">
            <Link className="ihype-btn-outline fan-dash-action" href="/shows">{t('meDashboardPage.browseEvents', 'Browse events')}</Link>
            <Link className="ihype-btn-outline fan-dash-action" href="/tickets">{t('meDashboardPage.viewMyTickets', 'View my tickets')}</Link>
            <Link className="ihype-btn-outline fan-dash-action" href="/community">{t('meDashboardPage.communityVotes', 'Community votes')}</Link>
            <Link className="ihype-btn-outline fan-dash-action" href="/me/promote">{t('meDashboardPage.hypeLinkEarnings', 'HYPE Link earnings')}</Link>
            {ownFanProfile ? (
              <Link className="ihype-btn-outline fan-dash-action" href={`/fans/${ownFanProfile.slug}`}>{t('meDashboardPage.viewMyPage', 'View my page')}</Link>
            ) : (
              <Link className="ihype-btn-outline fan-dash-action" href="/pages">{t('meDashboardPage.setUpMyPage', 'Set up my page')}</Link>
            )}
            <Link className="ihype-btn-outline fan-dash-action" href="/radio">{t('meDashboardPage.tuneIntoRadio', 'Tune into radio')}</Link>
          </div>
        </div>
      </div>

      {/* Notifications live here rather than on their own /me/notifications
          page — the standalone route is now a redirect alias. Same query and
          same component, so read/mark-read still POST to
          /api/me/notifications unchanged. */}
      <div className="fan-dash-notifications">
        <div className="fan-dash-section-head">
          <span className="fan-dash-eyebrow-sm">{t('meDashboardPage.notifications', 'Notifications')}</span>
        </div>
        <NotificationsList
          initialNotifications={notifications.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() }))}
        />
      </div>

      <style>{`
        .fan-dash-notifications { margin-top: 54px; padding-top: 28px; border-top: 1px solid var(--line); }
        .fan-dash-container { max-width: 1240px; margin: 0 auto; padding: clamp(42px,6vw,82px) 24px 120px; }
        .fan-dash-header { min-height: 280px; position: relative; display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 28px; margin-bottom: 34px; padding: clamp(30px,5vw,64px); overflow: hidden; border: 1px solid var(--line); border-radius: 28px; background: radial-gradient(circle at 82% 18%,rgba(var(--accent-rgb),.34),transparent 30%),radial-gradient(circle at 68% 72%,rgba(var(--role-venue-rgb),.17),transparent 35%),var(--hair-30); }
        .fan-dash-header::after { content: ""; width: 310px; height: 310px; position: absolute; right: 4%; top: -34%; border: 1px solid rgba(var(--role-venue-rgb),.2); border-radius: 50%; box-shadow: 0 0 0 46px rgba(var(--role-venue-rgb),.035),0 0 0 92px rgba(var(--accent-rgb),.025); pointer-events: none; }
        .fan-dash-header > * { position: relative; z-index: 1; }
        .fan-dash-eyebrow { font-family: var(--font-mono); font-size: 10px; letter-spacing: .2em; text-transform: uppercase; color: var(--accent-3,var(--role-venue)); margin-bottom: 10px; }
        .fan-dash-header h1 { max-width: 8ch; font-family: var(--font-display); font-size: clamp(3.2rem,7vw,6.8rem); line-height: .86; font-weight: 800; letter-spacing: -.07em; margin: 0; color: var(--ink); }
        .fan-dash-intro { max-width: 48ch; margin: 20px 0 0; color: var(--ink-a60); font-size: 14px; line-height: 1.6; }
        .fan-dash-header-actions { display: flex; gap: 10px; }
        .fan-dash-stats { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 12px; margin-bottom: 48px; }
        .fan-dash-stat-card { min-height: 150px; display: flex; flex-direction: column; justify-content: flex-end; text-decoration: none; padding: 24px; border: 1px solid var(--line); border-radius: 20px; background: linear-gradient(145deg,var(--hair-50),transparent); color: inherit; transition: transform .18s ease,border-color .18s ease; }
        .fan-dash-stat-card:hover { transform: translateY(-3px); border-color: var(--line-2); }
        .fan-dash-stat-label { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: .14em; color: var(--ink-a50); margin-bottom: 6px; }
        .fan-dash-stat-value { font-family: var(--font-display); font-weight: 800; font-size: clamp(2rem,4vw,3.6rem); line-height: 1; letter-spacing: -.05em; color: var(--ink); }
        .fan-dash-stat-sub { font-size: 11.5px; color: var(--ink-a50); margin-top: 2px; }
        .fan-dash-grid { display: grid; grid-template-columns: minmax(0,1.4fr) minmax(280px,.6fr); gap: 38px; }
        @media (max-width: 760px) { .fan-dash-header { min-height: 360px; align-items: flex-end; } .fan-dash-stats,.fan-dash-grid { grid-template-columns: 1fr; } }
        .fan-dash-section-head { display: flex; justify-content: space-between; align-items: baseline; }
        .fan-dash-eyebrow-sm { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: .14em; color: var(--ink-a50); }
        .fan-dash-empty { text-align: center; padding: 40px 24px; color: var(--ink-a50); border: 1px solid var(--line); border-radius: var(--radius-md, 10px); background: var(--bg2); margin-top: 12px; margin-bottom: 28px; }
        .fan-dash-show-list { overflow: hidden; border: 1px solid var(--line); border-radius: 18px; background: var(--hair-30); margin-top: 12px; margin-bottom: 28px; }
        .fan-dash-show-row { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; text-decoration: none; color: inherit; border-bottom: 1px solid var(--line); }
        .fan-dash-show-row:last-child { border-bottom: none; }
        .fan-dash-show-row:hover { background: var(--bg3); }
        .fan-dash-show-title { font-family: var(--font-display); font-weight: 800; font-size: 14px; color: var(--ink); }
        .fan-dash-show-meta { font-size: 12px; color: var(--ink-a55); margin-top: 2px; }
        .fan-dash-pill { display: inline-flex; align-items: center; padding: 4px 10px; border-radius: var(--radius-pill, 9999px); background: rgba(var(--role-fan-rgb),.15); color: var(--role-fan); font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: .1em; }
        .fan-dash-activity-list { display: flex; flex-direction: column; gap: 10px; margin-top: 12px; }
        .fan-dash-activity-row { display: flex; gap: 12px; align-items: flex-start; padding: 12px 0; border-bottom: 1px solid var(--line); }
        .fan-dash-activity-row:last-child { border-bottom: none; }
        .fan-dash-activity-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; margin-top: 6px; }
        .fan-dash-activity-text { font-size: 13px; color: var(--ink-a80, var(--ink)); }
        .fan-dash-actions { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 9px; margin-top: 12px; }
        .fan-dash-action { min-height: 76px; display: flex; align-items: flex-end; justify-content: flex-start; padding: 14px; text-align: left; border-radius: 14px; }
        .ihype-btn-outline { display: inline-block; padding: 10px 16px; border: 1px solid var(--line); background: transparent; color: var(--ink); border-radius: var(--radius-sm, 8px); cursor: pointer; font-size: 13px; text-decoration: none; transition: background 150ms; }
        .ihype-btn-outline:hover { background: var(--hair-50); }
      `}</style>
    </div>
  );
}

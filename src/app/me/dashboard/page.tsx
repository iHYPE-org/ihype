import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getPromoterDashboard } from '@/lib/promoterDashboard';
import { formatCurrencyFromCents } from '@/lib/ticketing';

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
      color: 'var(--role-fan, #b983ff)',
      text: (
        <>
          You hyped <strong style={{ color: 'var(--ink)' }}>{h.show.title}</strong>
          {h.show.headlinerProfile?.name ? ` by ${h.show.headlinerProfile.name}` : ''}
        </>
      ),
      at: h.createdAt,
    })),
    ...(recentReferralOrder
      ? [
          {
            id: `ref-${recentReferralOrder.id}`,
            color: 'var(--role-venue, #22e5d4)',
            text: (
              <>
                Someone bought a ticket to <strong style={{ color: 'var(--ink)' }}>{recentReferralOrder.show.title}</strong> via
                your HYPE Link — <strong style={{ color: 'var(--ink)' }}>+{formatCurrencyFromCents(recentReferralOrder.promoterPayoutCents)}</strong>
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
          <div className="fan-dash-eyebrow">Welcome back</div>
          <h1>{displayName}</h1>
        </div>
        <div className="fan-dash-header-actions">
          <Link className="ihype-btn-outline" href="/listen">Find a show</Link>
        </div>
      </div>

      <div className="fan-dash-stats">
        {/* NOTE: no "Listening Streak" card — nothing in the schema tracks daily
            listen streaks (no field/model for it). Per this codebase's
            convention, that card is omitted rather than fabricated. */}
        <Link className="fan-dash-stat-card" href="/tickets">
          <div className="fan-dash-stat-label">Hype Cast</div>
          <div className="fan-dash-stat-value">{hypeCastCount}</div>
          <div className="fan-dash-stat-sub">Shows you&apos;ve hyped</div>
        </Link>
        <div className="fan-dash-stat-card">
          <div className="fan-dash-stat-label">Referral Earned</div>
          <div className="fan-dash-stat-value" style={{ color: 'var(--role-fan, #b983ff)' }}>
            {formatCurrencyFromCents(promoterDashboard.earnedCents)}
          </div>
          <div className="fan-dash-stat-sub">From your HYPE Link (pending settlement)</div>
        </div>
        <div className="fan-dash-stat-card">
          <div className="fan-dash-stat-label">Next Show</div>
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
              <div className="fan-dash-stat-sub">No upcoming tickets</div>
            </>
          )}
        </div>
      </div>

      <div className="fan-dash-grid">
        <div>
          <div className="fan-dash-section-head">
            <span className="fan-dash-eyebrow-sm">Upcoming Shows</span>
          </div>
          {upcomingShows.length === 0 ? (
            <div className="fan-dash-empty">
              <p>No upcoming shows — find one to attend.</p>
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
                  <span className="fan-dash-pill">Attending</span>
                </Link>
              ))}
            </div>
          )}

          <div className="fan-dash-section-head" style={{ marginTop: 28 }}>
            <span className="fan-dash-eyebrow-sm">Activity</span>
          </div>
          {activity.length === 0 ? (
            <div className="fan-dash-empty"><p>No activity yet.</p></div>
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
            <span className="fan-dash-eyebrow-sm">Quick Actions</span>
          </div>
          <div className="fan-dash-actions">
            <Link className="ihype-btn-outline fan-dash-action" href="/listen">Browse events</Link>
            <Link className="ihype-btn-outline fan-dash-action" href="/tickets">View my tickets</Link>
            {ownFanProfile ? (
              <Link className="ihype-btn-outline fan-dash-action" href={`/fans/${ownFanProfile.slug}`}>View my page</Link>
            ) : (
              <Link className="ihype-btn-outline fan-dash-action" href="/pages">Set up my page</Link>
            )}
            <Link className="ihype-btn-outline fan-dash-action" href="/radio">Tune into radio</Link>
          </div>
        </div>
      </div>

      <style>{`
        .fan-dash-container { max-width: 1000px; margin: 0 auto; padding: 40px 24px 80px; }
        .fan-dash-header { display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 16px; margin-bottom: 28px; }
        .fan-dash-eyebrow { font-family: var(--font-mono); font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: var(--ink-a50); margin-bottom: 6px; }
        .fan-dash-header h1 { font-family: var(--font-display); font-size: 28px; font-weight: 800; letter-spacing: -.02em; margin: 0; color: var(--ink); }
        .fan-dash-header-actions { display: flex; gap: 10px; }
        .fan-dash-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 32px; }
        .fan-dash-stat-card { display: block; text-decoration: none; padding: 18px 20px; border: 1px solid var(--line); border-radius: var(--radius-md, 12px); background: var(--bg2); color: inherit; }
        .fan-dash-stat-label { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: .14em; color: var(--ink-a50); margin-bottom: 6px; }
        .fan-dash-stat-value { font-family: var(--font-display); font-weight: 800; font-size: 24px; color: var(--ink); }
        .fan-dash-stat-sub { font-size: 11.5px; color: var(--ink-a50); margin-top: 2px; }
        .fan-dash-grid { display: grid; grid-template-columns: 1fr 320px; gap: 20px; }
        @media (max-width: 760px) { .fan-dash-grid { grid-template-columns: 1fr; } }
        .fan-dash-section-head { display: flex; justify-content: space-between; align-items: baseline; }
        .fan-dash-eyebrow-sm { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: .14em; color: var(--ink-a50); }
        .fan-dash-empty { text-align: center; padding: 40px 24px; color: var(--ink-a50); border: 1px solid var(--line); border-radius: var(--radius-md, 10px); background: var(--bg2); margin-top: 12px; margin-bottom: 28px; }
        .fan-dash-show-list { border: 1px solid var(--line); border-radius: var(--radius-md, 10px); background: var(--bg2); margin-top: 12px; margin-bottom: 28px; }
        .fan-dash-show-row { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; text-decoration: none; color: inherit; border-bottom: 1px solid var(--line); }
        .fan-dash-show-row:last-child { border-bottom: none; }
        .fan-dash-show-row:hover { background: var(--bg3); }
        .fan-dash-show-title { font-family: var(--font-display); font-weight: 800; font-size: 14px; color: var(--ink); }
        .fan-dash-show-meta { font-size: 12px; color: var(--ink-a55); margin-top: 2px; }
        .fan-dash-pill { display: inline-flex; align-items: center; padding: 4px 10px; border-radius: var(--radius-pill, 9999px); background: rgba(185,131,255,.15); color: var(--role-fan, #b983ff); font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: .1em; }
        .fan-dash-activity-list { display: flex; flex-direction: column; gap: 10px; margin-top: 12px; }
        .fan-dash-activity-row { display: flex; gap: 12px; align-items: flex-start; padding: 12px 0; border-bottom: 1px solid var(--line); }
        .fan-dash-activity-row:last-child { border-bottom: none; }
        .fan-dash-activity-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; margin-top: 6px; }
        .fan-dash-activity-text { font-size: 13px; color: var(--ink-a80, var(--ink)); }
        .fan-dash-actions { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }
        .fan-dash-action { text-align: center; }
        .ihype-btn-outline { display: inline-block; padding: 10px 16px; border: 1px solid var(--line); background: transparent; color: var(--ink); border-radius: var(--radius-sm, 8px); cursor: pointer; font-size: 13px; text-decoration: none; transition: background 150ms; }
        .ihype-btn-outline:hover { background: var(--hair-50, rgba(255,255,255,.05)); }
      `}</style>
    </div>
  );
}

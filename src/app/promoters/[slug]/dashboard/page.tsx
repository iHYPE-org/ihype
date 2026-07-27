import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { canManageOwnedResource } from '@/lib/permissions';
import { getProfileInsights } from '@/lib/profile-insights';
import { formatCurrencyFromCents } from '@/lib/ticketing';
import { getLocale, getT } from '@/lib/i18n/server';

export const metadata: Metadata = {
  title: 'DJ Dashboard · iHYPE',
  robots: { index: false, follow: false },
};

type ActivityItem = { key: string; text: string; color: string; date: Date };

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function formatShowMeta(startsAt: Date, status: string, t: (key: string, fallback: string) => string) {
  if (status === 'LIVE') return t('promotersSlugDashboardPage.liveNow', 'Live now');
  return startsAt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function timeAgo(date: Date, t: (key: string, fallback: string) => string) {
  const diffMs = Date.now() - date.getTime();
  const days = Math.floor(diffMs / 86400000);
  if (days <= 0) return t('promotersSlugDashboardPage.timeAgoToday', 'today');
  if (days === 1) return t('promotersSlugDashboardPage.timeAgoOneDay', '1 day ago');
  if (days < 7) return `${days} ${t('promotersSlugDashboardPage.timeAgoDaysAgo', 'days ago')}`;
  const weeks = Math.floor(days / 7);
  return weeks === 1 ? t('promotersSlugDashboardPage.timeAgoOneWeek', '1 week ago') : `${weeks} ${t('promotersSlugDashboardPage.timeAgoWeeksAgo', 'weeks ago')}`;
}

export default async function DJDashboardPage({ params }: { params: Promise<{ slug: string }> }) {
  const t = getT(await getLocale());
  const { slug } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/promoters/${slug}/dashboard`);
  }

  const profile = await db.profile.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true, ownerId: true, type: true },
  });
  if (!profile || profile.type !== 'DJ') return notFound();

  const isOwner = canManageOwnedResource(session, profile.ownerId);
  if (!isOwner) return notFound();

  const now = new Date();
  const monthStart = startOfMonth(now);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);

  const [
    insights,
    earningsAllOrders,
    showsAiredTotal,
    showsAiredThisMonth,
    crateSize,
    upcomingShows,
    recentShowsForActivity,
    recentTracks,
    recentTicketOrders,
  ] = await Promise.all([
    getProfileInsights(profile.id, 'DJ'),
    db.ticketOrder.findMany({
      where: { affiliatePromoterProfileId: profile.id, status: { in: ['CAPTURED', 'RESERVED'] } },
      select: { promoterPayoutCents: true, createdAt: true },
    }),
    db.show.count({ where: { promoterProfileId: profile.id, status: 'ENDED' } }),
    db.show.count({ where: { promoterProfileId: profile.id, status: 'ENDED', startsAt: { gte: monthStart } } }),
    db.artistMediaAsset.count({ where: { profileId: profile.id, freeUseEnabled: true } }),
    db.show.findMany({
      where: {
        status: { in: ['LIVE', 'SCHEDULED', 'DRAFT'] },
        OR: [
          { promoterProfileId: profile.id },
          // Booked as a lineup act on someone else's venue-booked show (see
          // the Lineup & Split Agreement) — previously invisible here even
          // though the DJ gets a real notification when this happens.
          { lineupSlots: { some: { profileId: profile.id } } },
        ],
      },
      orderBy: { startsAt: 'asc' },
      take: 8,
      select: {
        slug: true, title: true, startsAt: true, status: true, promoterProfileId: true,
        lineupSlots: { where: { profileId: profile.id }, select: { status: true } },
      },
    }),
    db.show.findMany({
      where: { promoterProfileId: profile.id },
      orderBy: { startsAt: 'desc' },
      take: 6,
      select: { title: true, hypes: { where: { createdAt: { gte: thirtyDaysAgo } }, select: { createdAt: true } } },
    }),
    db.artistMediaAsset.findMany({
      where: { profileId: profile.id, createdAt: { gte: thirtyDaysAgo }, isPublished: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { title: true, createdAt: true },
    }),
    db.ticketOrder.findMany({
      where: { affiliatePromoterProfileId: profile.id, status: 'CAPTURED', createdAt: { gte: thirtyDaysAgo } },
      select: { quantity: true, createdAt: true },
    }),
  ]);

  const earningsThisMonthCents = earningsAllOrders
    .filter((o) => o.createdAt >= monthStart)
    .reduce((sum, o) => sum + o.promoterPayoutCents, 0);

  // Activity feed — merged from three real sources, no fabricated events.
  const activity: ActivityItem[] = [];
  for (const s of recentShowsForActivity) {
    if (s.hypes.length > 0) {
      const latestHype = s.hypes.reduce((a, b) => (b.createdAt > a ? b.createdAt : a), s.hypes[0].createdAt);
      activity.push({
        key: `hype-${s.title}`,
        text: `${s.hypes.length} ${s.hypes.length === 1 ? t('promotersSlugDashboardPage.hypeSingular', 'hype') : t('promotersSlugDashboardPage.hypePlural', 'hypes')} ${t('promotersSlugDashboardPage.onShow', 'on')} ${s.title}`,
        color: 'var(--profile-accent, #ff3e9a)',
        date: latestHype,
      });
    }
  }
  for (const track of recentTracks) {
    activity.push({
      key: `track-${track.title}-${track.createdAt.toISOString()}`,
      text: `"${track.title}" ${t('promotersSlugDashboardPage.clearedVetting', 'cleared vetting and joined your crate')}`,
      color: 'var(--role-venue, #22e5d4)',
      date: track.createdAt,
    });
  }
  if (recentTicketOrders.length > 0) {
    const totalQty = recentTicketOrders.reduce((sum, o) => sum + o.quantity, 0);
    const latest = recentTicketOrders.reduce((a, b) => (b.createdAt > a ? b.createdAt : a), recentTicketOrders[0].createdAt);
    activity.push({
      key: 'ticket-sales',
      text: `${totalQty} ${totalQty === 1 ? t('promotersSlugDashboardPage.ticketSingular', 'ticket') : t('promotersSlugDashboardPage.ticketPlural', 'tickets')} ${t('promotersSlugDashboardPage.soldViaHypeLinks', 'sold via your HYPE Links in the last 30 days')}`,
      color: 'var(--role-fan, #b983ff)',
      date: latest,
    });
  }
  activity.sort((a, b) => b.date.getTime() - a.date.getTime());
  const activityFeed = activity.slice(0, 6);

  const stats = [
    {
      label: t('promotersSlugDashboardPage.statPromoterEarnings', 'Promoter Earnings'),
      value: formatCurrencyFromCents(earningsThisMonthCents),
      sub: t('promotersSlugDashboardPage.poolShareThisMonth', '10% pool share this month'),
    },
    {
      label: t('promotersSlugDashboardPage.statListeners', 'Listeners'),
      value: (insights.listeners?.distinctListeners ?? 0).toLocaleString(),
      sub: `${(insights.listeners?.totalPlays ?? 0).toLocaleString()} ${t('promotersSlugDashboardPage.totalPlays', 'total plays')}`,
    },
    {
      label: t('promotersSlugDashboardPage.statShowsAired', 'Shows Aired'),
      value: showsAiredTotal.toLocaleString(),
      sub: `${showsAiredThisMonth} ${t('promotersSlugDashboardPage.thisMonth', 'this month')}`,
    },
    {
      label: t('promotersSlugDashboardPage.statCrateSize', 'Crate Size'),
      value: crateSize.toLocaleString(),
      sub: t('promotersSlugDashboardPage.tracksCleared', 'tracks cleared'),
    },
  ];

  return (
    <div className="djd-page">
      <div className="djd-header">
        <div>
          <div className="djd-eyebrow">{t('promotersSlugDashboardPage.welcomeBack', 'Welcome back')}</div>
          <h1 className="djd-title">{profile.name}</h1>
        </div>
        <div className="djd-header-actions">
          <Link className="djd-btn djd-btn-outline" href={`/promoters/${profile.slug}?section=crate`}>{t('promotersSlugDashboardPage.myCrateLink', 'My Crate')}</Link>
          <Link className="djd-btn djd-btn-solid" href="/radio/studio">{t('promotersSlugDashboardPage.scheduleShowLink', '+ Schedule a Show')}</Link>
        </div>
      </div>

      <div className="djd-stat-grid">
        {stats.map((s) => (
          <div className="djd-card" key={s.label}>
            <div className="djd-stat-label">{s.label}</div>
            <div className="djd-stat-value">{s.value}</div>
            <div className="djd-stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="djd-columns">
        <div>
          <div className="djd-eyebrow-row">
            <span className="djd-section-eyebrow">{t('promotersSlugDashboardPage.upcomingShows', 'Upcoming Shows')}</span>
          </div>
          {upcomingShows.length === 0 ? (
            <div className="djd-empty"><p>{t('promotersSlugDashboardPage.noShowsScheduled', 'No shows scheduled — create one to get started.')}</p></div>
          ) : (
            <div className="djd-show-list">
              {upcomingShows.map((s) => {
                const isLineupBooking = s.promoterProfileId !== profile.id;
                const myLineupStatus = s.lineupSlots[0]?.status;
                return (
                  <Link
                    className="djd-show-row"
                    href={s.status === 'DRAFT' ? `/shows/${s.slug}/lineup` : `/shows/${s.slug}`}
                    key={s.slug}
                  >
                    <div>
                      <div className="djd-show-title">{s.title}</div>
                      <div className="djd-show-meta">
                        {formatShowMeta(s.startsAt, s.status, t)}
                        {isLineupBooking && myLineupStatus === 'PENDING' && ` · ${t('promotersSlugDashboardPage.lineupInviteReview', 'Lineup invite — review split')}`}
                        {isLineupBooking && myLineupStatus === 'ACCEPTED' && ` · ${t('promotersSlugDashboardPage.bookedAsLineupAct', 'Booked as lineup act')}`}
                      </div>
                    </div>
                    {s.status === 'LIVE' ? (
                      <span className="djd-live-pill"><span className="djd-live-dot" />{t('promotersSlugDashboardPage.liveLabel', 'Live')}</span>
                    ) : s.status === 'DRAFT' ? (
                      <span className="djd-scheduled-pill">{t('promotersSlugDashboardPage.draftLabel', 'Draft')}</span>
                    ) : (
                      <span className="djd-scheduled-pill">{t('promotersSlugDashboardPage.scheduledLabel', 'Scheduled')}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          )}

          <div className="djd-section-eyebrow" style={{ marginTop: 28 }}>{t('promotersSlugDashboardPage.activity', 'Activity')}</div>
          {activityFeed.length === 0 ? (
            <div className="djd-empty"><p>{t('promotersSlugDashboardPage.noActivity', 'No activity yet.')}</p></div>
          ) : (
            <div className="djd-activity-list">
              {activityFeed.map((item) => (
                <div className="djd-activity-row" key={item.key}>
                  <div className="djd-activity-dot" style={{ background: item.color }} />
                  <div className="djd-activity-text">{item.text}</div>
                  <div className="djd-activity-time">{timeAgo(item.date, t)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="djd-section-eyebrow">{t('promotersSlugDashboardPage.quickActions', 'Quick Actions')}</div>
          <div className="djd-actions-list">
            <Link className="djd-action-btn" href={`/promoters/${profile.slug}?section=crate`}>{t('promotersSlugDashboardPage.addToCrateLink', 'Add to crate')}</Link>
            <Link className="djd-action-btn" href="/radio">{t('promotersSlugDashboardPage.showArchiveLink', 'Show archive')}</Link>
            <Link className="djd-action-btn" href={`/promoters/${profile.slug}/analytics`}>{t('promotersSlugDashboardPage.viewInsightsLink', 'View insights')}</Link>
            <Link className="djd-action-btn" href={`/promoters/${profile.slug}`}>{t('promotersSlugDashboardPage.editMyPageLink', 'Edit my page')}</Link>
            <Link className="djd-action-btn" href="/radio/studio">{t('promotersSlugDashboardPage.radioShowCreatorLink', 'Radio Show Creator')}</Link>
          </div>
        </div>
      </div>

      <style>{`
        .djd-page { max-width: 1000px; margin: 0 auto; padding: 40px 24px 80px; }
        .djd-header { display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 16px; margin-bottom: 28px; }
        .djd-eyebrow { font-family: var(--font-mono); font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: var(--ink-a50); margin-bottom: 6px; }
        .djd-title { font-family: var(--font-display); font-size: 28px; font-weight: 800; letter-spacing: -.02em; margin: 0; color: var(--ink); }
        .djd-header-actions { display: flex; gap: 10px; }
        .djd-btn { display: inline-flex; align-items: center; justify-content: center; padding: 10px 18px; border-radius: var(--radius-md, 12px); font-size: 13px; font-weight: 700; text-decoration: none; }
        .djd-btn-outline { background: var(--bg2); color: var(--ink); border: 1px solid var(--hair-100); }
        .djd-btn-outline:hover { background: var(--bg3); }
        .djd-btn-solid { background: var(--profile-accent, #ff3e9a); color: #fff; border: 1px solid transparent; }
        .djd-btn-solid:hover { opacity: .9; }
        .djd-stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 32px; }
        .djd-card { border: 1px solid var(--line); border-radius: var(--radius-lg, 18px); background: var(--bg2); padding: 18px 20px; }
        .djd-stat-label { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: .14em; color: var(--ink-a50); margin-bottom: 6px; }
        .djd-stat-value { font-family: var(--font-display); font-weight: 800; font-size: 24px; color: var(--profile-accent, #ff3e9a); }
        .djd-stat-sub { font-size: 11.5px; color: var(--ink-a50); margin-top: 2px; }
        .djd-columns { display: grid; grid-template-columns: 1fr 320px; gap: 20px; }
        @media (max-width: 760px) { .djd-columns { grid-template-columns: 1fr; } }
        .djd-eyebrow-row { display: flex; justify-content: space-between; align-items: baseline; }
        .djd-section-eyebrow { font-family: var(--font-mono); font-size: 12px; text-transform: uppercase; letter-spacing: .12em; color: var(--ink-a50); }
        .djd-empty { text-align: center; padding: 40px 24px; color: var(--ink-a50); border: 1px solid var(--line); border-radius: var(--radius-md, 10px); background: var(--bg2); margin-top: 12px; margin-bottom: 28px; }
        .djd-show-list { border: 1px solid var(--line); border-radius: var(--radius-md, 10px); background: var(--bg2); margin-top: 12px; margin-bottom: 28px; }
        .djd-show-row { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--line); text-decoration: none; color: inherit; }
        .djd-show-row:last-child { border-bottom: none; }
        .djd-show-row:hover { background: var(--bg3); }
        .djd-show-title { font-family: var(--font-display); font-weight: 800; font-size: 14px; color: var(--ink); }
        .djd-show-meta { font-size: 12px; color: var(--ink-a55); margin-top: 2px; }
        .djd-live-pill { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: var(--radius-pill, 999px); background: rgba(255,62,154,.15); color: #ff3e9a; font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: .12em; }
        .djd-live-dot { width: 6px; height: 6px; border-radius: 50%; background: #ff3e9a; }
        .djd-scheduled-pill { display: inline-flex; align-items: center; padding: 4px 10px; border-radius: var(--radius-pill, 999px); border: 1px solid var(--hair-100); color: var(--ink-a55); font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: .12em; }
        .djd-activity-list { display: flex; flex-direction: column; gap: 2px; margin-top: 12px; }
        .djd-activity-row { display: flex; gap: 12px; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--line); }
        .djd-activity-row:last-child { border-bottom: none; }
        .djd-activity-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
        .djd-activity-text { font-size: 13px; color: var(--ink-a60); flex: 1; }
        .djd-activity-time { font-size: 11px; color: var(--ink-a50); flex-shrink: 0; }
        .djd-actions-list { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }
        .djd-action-btn { display: flex; align-items: center; justify-content: center; padding: 12px 16px; border-radius: var(--radius-md, 12px); border: 1px solid var(--hair-100); background: var(--bg2); color: var(--ink); font-size: 13px; font-weight: 600; text-decoration: none; }
        .djd-action-btn:hover { background: var(--bg3); }
      `}</style>
    </div>
  );
}

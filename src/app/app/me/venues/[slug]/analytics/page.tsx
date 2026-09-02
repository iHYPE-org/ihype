import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { canManageOwnedResource } from '@/lib/permissions';
import { getVenueAnalyticsData, type VenueAnalyticsRange } from '@/lib/venue-analytics';
import { formatCurrencyFromCents } from '@/lib/ticketing';
import { getServerT } from '@/lib/i18n/server';
import { describeDemand, proximityWeight, scoreFanDemand, type DemandVenue } from '@/lib/fan-demand';

export const dynamic = 'force-dynamic';

function getRangeTabs(t: (key: string, fallback?: string) => string): { id: VenueAnalyticsRange; label: string }[] {
  return [
    { id: '7d', label: t('venuesSlugAnalyticsPage.range7d', '7 Days') },
    { id: '30d', label: t('venuesSlugAnalyticsPage.range30d', '30 Days') },
    { id: 'ytd', label: t('venuesSlugAnalyticsPage.rangeYtd', 'YTD') },
  ];
}

function getActiveRange(range: string | string[] | undefined): VenueAnalyticsRange {
  const value = Array.isArray(range) ? range[0] : range;
  if (value === '7d' || value === '30d' || value === 'ytd') return value;
  return '30d';
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const profile = await db.profile.findUnique({ where: { slug }, select: { name: true } });
  return {
    title: profile ? `${profile.name} · Analytics · iHYPE` : 'Venue Analytics · iHYPE',
    robots: { index: false, follow: false },
  };
}

export default async function VenueAnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const t = await getServerT();
  const RANGE_TABS = getRangeTabs(t);
  const { slug } = await params;
  const { range: rangeParam } = await searchParams;
  const range = getActiveRange(rangeParam);

  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/app/me/venues/${slug}/analytics`);
  }

  const profile = await db.profile.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true, type: true, ownerId: true, city: true, stateRegion: true, latitude: true, longitude: true },
  });
  if (!profile || profile.type !== 'VENUE') return notFound();

  const isOwner = canManageOwnedResource(session, profile.ownerId);
  if (!isOwner) return notFound();

  const data = await getVenueAnalyticsData(profile.id, range);

  /* Acts fans NEAR THIS VENUE are asking other rooms for — the mirror of the
     artist's "Where fans want you" (2026-09-01). The venue's own radar already
     ranks asks addressed to it; this is the demand in its catchment that went
     elsewhere, which is exactly the act a booker wants to hear about first.
     Same core as the radar (`scoreFanDemand`), scored against THIS venue's
     location, keeping only acts with at least one fan the proximity rule
     calls nearby. Pending only; not windowed by the range tabs. Legacy rows
     without a stored fan location fall back to the requester's profile. */
  const here: DemandVenue = { city: profile.city, stateRegion: profile.stateRegion, latitude: profile.latitude, longitude: profile.longitude };
  const nearbyRows = await db.venueConnectionRequest.findMany({
    where: { status: 'PENDING', artistProfileId: { not: null }, venueProfileId: { not: profile.id } },
    orderBy: { createdAt: 'desc' },
    take: 500,
    select: {
      artistProfileId: true, artistName: true, requesterId: true, createdAt: true,
      requesterCity: true, requesterStateRegion: true, requesterLatitude: true, requesterLongitude: true,
      artistProfile: { select: { slug: true, name: true } },
      requester: { select: { profiles: { select: { city: true, stateRegion: true, latitude: true, longitude: true }, take: 1 } } },
    },
  }).catch(() => []);
  const artistById = new Map(nearbyRows.map((row) => [row.artistProfileId as string, row.artistProfile]));
  const located = nearbyRows.map((row) => {
    const fallback = row.requester.profiles[0];
    const hasStored = row.requesterCity || row.requesterStateRegion || row.requesterLatitude !== null;
    return hasStored || !fallback
      ? row
      : { ...row, requesterCity: fallback.city, requesterStateRegion: fallback.stateRegion, requesterLatitude: fallback.latitude, requesterLongitude: fallback.longitude };
  });
  const nearbyDemand = scoreFanDemand(located.filter((row) => proximityWeight(row, here).nearby), here)
    .filter((entry) => entry.nearby > 0)
    .slice(0, 8);
  const maxAttendance = Math.max(1, ...data.buckets.map((b) => b.attendance));

  return (
    <div className="vaa">
      <header className="vaa-head">
        <h1>{t('venuesSlugAnalyticsPage.title', 'Analytics')}</h1>
      </header>

      <div className="vaa-tabs">
        {RANGE_TABS.map((tab) => (
          <Link
            className={tab.id === range ? 'vaa-tab active' : 'vaa-tab'}
            href={`/app/me/venues/${profile.slug}/analytics?range=${tab.id}`}
            key={tab.id}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <div className="vaa-stats">
        <div className="vaa-card">
          <div className="vaa-card-label">{t('venuesSlugAnalyticsPage.totalAttendance', 'Total Attendance')}</div>
          <div className="vaa-card-val">{data.totalAttendance.toLocaleString()}</div>
          <div className="vaa-card-sub vaa-card-sub-accent">
            {data.totalAttendanceDeltaPct !== null
              ? `${data.totalAttendanceDeltaPct >= 0 ? '+' : ''}${data.totalAttendanceDeltaPct}% ${t('venuesSlugAnalyticsPage.thisPeriodSuffix', 'this period')}`
              : t('venuesSlugAnalyticsPage.ticketsSoldAcrossShows', 'Tickets sold across shows in range')}
          </div>
        </div>
        <div className="vaa-card">
          <div className="vaa-card-label">{t('venuesSlugAnalyticsPage.selloutRate', 'Sellout Rate')}</div>
          <div className="vaa-card-val">{data.selloutRatePct !== null ? `${data.selloutRatePct}%` : '—'}</div>
          <div className="vaa-card-sub vaa-card-sub-accent">
            {data.selloutRateDeltaPts !== null
              ? `${data.selloutRateDeltaPts >= 0 ? '+' : ''}${data.selloutRateDeltaPts}pt ${t('venuesSlugAnalyticsPage.thisPeriodSuffix', 'this period')}`
              : data.selloutRatePct !== null
                ? t('venuesSlugAnalyticsPage.soldOverCapacity', 'Sold / capacity across ticketed shows')
                : t('venuesSlugAnalyticsPage.noTicketedShowsYet', 'No ticketed shows with capacity yet')}
          </div>
        </div>
        <div className="vaa-card">
          <div className="vaa-card-label">{t('venuesSlugAnalyticsPage.showsBooked', 'Shows Booked')}</div>
          <div className="vaa-card-val">{data.showsBookedCount}</div>
          <div className="vaa-card-sub">{data.upcomingShowsCount} {t('venuesSlugAnalyticsPage.upcomingSuffix', 'upcoming')}</div>
        </div>
        <div className="vaa-card">
          <div className="vaa-card-label">{t('venuesSlugAnalyticsPage.grossShare', 'Gross (20% share)')}</div>
          <div className="vaa-card-val vaa-card-val-accent">{formatCurrencyFromCents(data.grossCents)}</div>
          <div className="vaa-card-sub">{t('venuesSlugAnalyticsPage.zeroFee', '$0 iHYPE fee')}</div>
        </div>
      </div>

      <div className="vaa-eyebrow">{t('venuesSlugAnalyticsPage.attendanceOverTime', 'Attendance over time')}</div>
      {data.buckets.length === 0 ? (
        <div className="vaa-empty">{t('venuesSlugAnalyticsPage.noShowsThisPeriod', 'No shows in this period yet.')}</div>
      ) : (
        <div className="vaa-chart">
          {data.buckets.map((b, i) => (
            <div className="vaa-chart-col" key={i} title={`${b.label}: ${b.attendance.toLocaleString()}`}>
              <div className="vaa-chart-bar" style={{ height: `${Math.max(4, Math.round((b.attendance / maxAttendance) * 100))}%` }} />
              <div className="vaa-chart-label">{b.label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="vaa-section-head">
        <span className="vaa-eyebrow-sm">{t('venuesSlugAnalyticsPage.topEvents', 'Top Events')}</span>
      </div>
      {data.topEvents.length === 0 ? (
        <div className="vaa-empty">{t('venuesSlugAnalyticsPage.noEventsThisPeriod', 'No events in this period yet.')}</div>
      ) : (
        <div className="vaa-events">
          {data.topEvents.map((event) => {
            const date = event.startsAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const soldLabel = event.ticketCapacity
              ? `${event.ticketsSoldCount.toLocaleString()} / ${event.ticketCapacity.toLocaleString()} ${t('venuesSlugAnalyticsPage.capSold', 'cap sold')}${event.soldOut ? ` · ${t('venuesSlugAnalyticsPage.soldOut', 'Sold out')}` : ''}`
              : `${event.ticketsSoldCount.toLocaleString()} ${t('venuesSlugAnalyticsPage.sold', 'sold')}`;
            return (
              <Link className="vaa-event-row" href={`/app/shows/${event.slug}`} key={event.id}>
                <div>
                  <div className="vaa-event-title">
                    {event.title}
                    {event.status === 'LIVE' ? ` — ${t('venuesSlugAnalyticsPage.live', 'Live')}` : ''} · {date}
                  </div>
                  <div className="vaa-event-meta">{soldLabel}</div>
                </div>
                <span className="vaa-event-gross">{formatCurrencyFromCents(event.grossCents)}</span>
              </Link>
            );
          })}
        </div>
      )}

      <div className="vaa-section-head">
        <span className="vaa-eyebrow-sm">{t('venuesSlugAnalyticsPage.nearbyDemand', 'Acts fans near you want')}</span>
      </div>
      {nearbyDemand.length === 0 ? (
        <div className="vaa-empty">
          {profile.city || profile.latitude !== null
            ? t('venuesSlugAnalyticsPage.noNearbyDemand', 'No fan near you has asked another venue for an act yet. Asks addressed to you are on your demand radar.')
            : t('venuesSlugAnalyticsPage.noLocationForDemand', 'Add your address so this can find the fans near you.')}
        </div>
      ) : (
        <div className="vaa-events">
          {nearbyDemand.map((entry) => {
            const artist = entry.artistProfileId ? artistById.get(entry.artistProfileId) : null;
            if (!artist) return null;
            return (
              <Link className="vaa-event-row" href={`/app/artists/${artist.slug}`} key={entry.key}>
                <div>
                  <div className="vaa-event-title">{artist.name}</div>
                  <div className="vaa-event-meta">{describeDemand(entry)} · {t('venuesSlugAnalyticsPage.askedElsewhere', 'asked of other venues')}</div>
                </div>
                <span className="vaa-event-gross">{entry.nearby.toLocaleString()} {entry.nearby === 1 ? t('venuesSlugAnalyticsPage.nearbyFan', 'nearby fan') : t('venuesSlugAnalyticsPage.nearbyFans', 'nearby fans')}</span>
              </Link>
            );
          })}
        </div>
      )}

      <style>{`
        .vaa { max-width: 1000px; margin: 0 auto; padding: 32px 24px 80px; }
        .vaa-head { margin-bottom: 20px; }
        .vaa-head h1 { font-family: var(--font-display); font-size: 1.75rem; font-weight: 800; letter-spacing: -.02em; margin: 0; color: var(--ink); }
        .vaa-tabs { display: flex; gap: 4px; border: 1px solid var(--line); border-radius: var(--radius-pill); padding: 4px; width: fit-content; margin-bottom: 28px; }
        .vaa-tab { padding: 8px 16px; border-radius: var(--radius-pill); font-size: 0.9375rem; font-weight: 700; color: var(--ink-a65); text-decoration: none; }
        .vaa-tab.active { background: var(--role-venue); color: var(--bg); }
        .vaa-tab:not(.active):hover { background: var(--hair-40); }
        .vaa-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 32px; }
        .vaa-card { border: 1px solid var(--line); border-radius: var(--radius-md); background: var(--bg2); padding: 18px 20px; }
        .vaa-card-label { font-family: var(--font-mono); font-size: 0.6875rem; text-transform: uppercase; letter-spacing: .14em; color: var(--ink-a65); margin-bottom: 6px; }
        .vaa-card-val { font-family: var(--font-display); font-weight: 800; font-size: 1.5rem; color: var(--ink); }
        .vaa-card-val-accent { color: var(--role-venue); }
        .vaa-card-sub { font-size: 0.9375rem; color: var(--ink-a65); margin-top: 2px; }
        .vaa-card-sub-accent { color: var(--role-venue); }
        .vaa-eyebrow { font-family: var(--font-mono); font-size: 0.9375rem; text-transform: uppercase; letter-spacing: .1em; color: var(--role-venue); margin-bottom: 14px; }
        .vaa-eyebrow-sm { font-family: var(--font-mono); font-size: 0.9375rem; text-transform: uppercase; letter-spacing: .1em; color: var(--ink-a65); }
        .vaa-section-head { display: flex; justify-content: space-between; align-items: baseline; margin-top: 32px; margin-bottom: 4px; }
        .vaa-chart { display: flex; align-items: flex-end; gap: 6px; height: 120px; margin-bottom: 32px; padding: 0 4px; }
        .vaa-chart-col { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; justify-content: flex-end; gap: 6px; }
        .vaa-chart-bar { width: 100%; border-radius: 4px 4px 0 0; background: var(--role-venue); min-height: 4px; }
        .vaa-chart-label { font-family: var(--font-mono); font-size: 0.9375rem; color: var(--ink-a65); }
        .vaa-empty { text-align: center; padding: 40px 24px; color: var(--ink-a65); border: 1px solid var(--line); border-radius: var(--radius-md); background: var(--bg2); margin-top: 12px; margin-bottom: 24px; font-size: 0.9375rem; }
        .vaa-events { border: 1px solid var(--line); border-radius: var(--radius-md); background: var(--bg2); margin-top: 12px; overflow: hidden; }
        .vaa-event-row { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--line); text-decoration: none; color: inherit; }
        .vaa-event-row:last-child { border-bottom: none; }
        .vaa-event-row:hover { background: var(--bg3); }
        .vaa-event-title { font-family: var(--font-display); font-weight: 800; font-size: 0.9375rem; color: var(--ink); }
        .vaa-event-meta { font-size: 0.9375rem; color: var(--ink-a65); margin-top: 2px; }
        .vaa-event-gross { font-family: var(--font-mono); font-size: 0.9375rem; color: var(--role-venue); font-weight: 700; flex-shrink: 0; }
      `}</style>
    </div>
  );
}

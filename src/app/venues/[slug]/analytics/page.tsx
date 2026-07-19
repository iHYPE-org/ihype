import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { canManageOwnedResource } from '@/lib/permissions';
import { getVenueAnalyticsData, type VenueAnalyticsRange } from '@/lib/venue-analytics';
import { formatCurrencyFromCents } from '@/lib/ticketing';

export const dynamic = 'force-dynamic';

const RANGE_TABS: { id: VenueAnalyticsRange; label: string }[] = [
  { id: '7d', label: '7 Days' },
  { id: '30d', label: '30 Days' },
  { id: 'ytd', label: 'YTD' },
];

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
  const { slug } = await params;
  const { range: rangeParam } = await searchParams;
  const range = getActiveRange(rangeParam);

  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/venues/${slug}/analytics`);
  }

  const profile = await db.profile.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true, type: true, ownerId: true },
  });
  if (!profile || profile.type !== 'VENUE') return notFound();

  const isOwner = canManageOwnedResource(session, profile.ownerId);
  if (!isOwner) return notFound();

  const data = await getVenueAnalyticsData(profile.id, range);
  const maxAttendance = Math.max(1, ...data.buckets.map((b) => b.attendance));

  return (
    <div className="vaa">
      <header className="vaa-head">
        <h1>Analytics</h1>
      </header>

      <div className="vaa-tabs">
        {RANGE_TABS.map((tab) => (
          <Link
            className={tab.id === range ? 'vaa-tab active' : 'vaa-tab'}
            href={`/venues/${profile.slug}/analytics?range=${tab.id}`}
            key={tab.id}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <div className="vaa-stats">
        <div className="vaa-card">
          <div className="vaa-card-label">Total Attendance</div>
          <div className="vaa-card-val">{data.totalAttendance.toLocaleString()}</div>
          <div className="vaa-card-sub vaa-card-sub-accent">
            {data.totalAttendanceDeltaPct !== null
              ? `${data.totalAttendanceDeltaPct >= 0 ? '+' : ''}${data.totalAttendanceDeltaPct}% this period`
              : 'Tickets sold across shows in range'}
          </div>
        </div>
        <div className="vaa-card">
          <div className="vaa-card-label">Sellout Rate</div>
          <div className="vaa-card-val">{data.selloutRatePct !== null ? `${data.selloutRatePct}%` : '—'}</div>
          <div className="vaa-card-sub vaa-card-sub-accent">
            {data.selloutRateDeltaPts !== null
              ? `${data.selloutRateDeltaPts >= 0 ? '+' : ''}${data.selloutRateDeltaPts}pt this period`
              : data.selloutRatePct !== null
                ? 'Sold / capacity across ticketed shows'
                : 'No ticketed shows with capacity yet'}
          </div>
        </div>
        <div className="vaa-card">
          <div className="vaa-card-label">Shows Booked</div>
          <div className="vaa-card-val">{data.showsBookedCount}</div>
          <div className="vaa-card-sub">{data.upcomingShowsCount} upcoming</div>
        </div>
        <div className="vaa-card">
          <div className="vaa-card-label">Gross (20% share)</div>
          <div className="vaa-card-val vaa-card-val-accent">{formatCurrencyFromCents(data.grossCents)}</div>
          <div className="vaa-card-sub">$0 iHYPE fee</div>
        </div>
      </div>

      <div className="vaa-eyebrow">Attendance over time</div>
      {data.buckets.length === 0 ? (
        <div className="vaa-empty">No shows in this period yet.</div>
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
        <span className="vaa-eyebrow-sm">Top Events</span>
      </div>
      {data.topEvents.length === 0 ? (
        <div className="vaa-empty">No events in this period yet.</div>
      ) : (
        <div className="vaa-events">
          {data.topEvents.map((event) => {
            const date = event.startsAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const soldLabel = event.ticketCapacity
              ? `${event.ticketsSoldCount.toLocaleString()} / ${event.ticketCapacity.toLocaleString()} cap sold${event.soldOut ? ' · Sold out' : ''}`
              : `${event.ticketsSoldCount.toLocaleString()} sold`;
            return (
              <Link className="vaa-event-row" href={`/shows/${event.slug}`} key={event.id}>
                <div>
                  <div className="vaa-event-title">
                    {event.title}
                    {event.status === 'LIVE' ? ' — Live' : ''} · {date}
                  </div>
                  <div className="vaa-event-meta">{soldLabel}</div>
                </div>
                <span className="vaa-event-gross">{formatCurrencyFromCents(event.grossCents)}</span>
              </Link>
            );
          })}
        </div>
      )}

      <style>{`
        .vaa { max-width: 1000px; margin: 0 auto; padding: 32px 24px 80px; }
        .vaa-head { margin-bottom: 20px; }
        .vaa-head h1 { font-family: var(--font-display); font-size: 28px; font-weight: 800; letter-spacing: -.02em; margin: 0; color: var(--ink); }
        .vaa-tabs { display: flex; gap: 4px; border: 1px solid var(--line); border-radius: var(--radius-pill); padding: 4px; width: fit-content; margin-bottom: 28px; }
        .vaa-tab { padding: 8px 16px; border-radius: var(--radius-pill); font-size: 13px; font-weight: 700; color: var(--ink-a60); text-decoration: none; }
        .vaa-tab.active { background: var(--role-venue, #22e5d4); color: #0a0805; }
        .vaa-tab:not(.active):hover { background: var(--hair-40); }
        .vaa-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 32px; }
        .vaa-card { border: 1px solid var(--line); border-radius: var(--radius-md); background: var(--bg2); padding: 18px 20px; }
        .vaa-card-label { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: .14em; color: var(--ink-a50); margin-bottom: 6px; }
        .vaa-card-val { font-family: var(--font-display); font-weight: 800; font-size: 24px; color: var(--ink); }
        .vaa-card-val-accent { color: var(--role-venue, #22e5d4); }
        .vaa-card-sub { font-size: 11.5px; color: var(--ink-a50); margin-top: 2px; }
        .vaa-card-sub-accent { color: var(--role-venue, #22e5d4); }
        .vaa-eyebrow { font-family: var(--font-mono); font-size: 12px; text-transform: uppercase; letter-spacing: .1em; color: var(--role-venue, #22e5d4); margin-bottom: 14px; }
        .vaa-eyebrow-sm { font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: .1em; color: var(--ink-a50); }
        .vaa-section-head { display: flex; justify-content: space-between; align-items: baseline; margin-top: 32px; margin-bottom: 4px; }
        .vaa-chart { display: flex; align-items: flex-end; gap: 6px; height: 120px; margin-bottom: 32px; padding: 0 4px; }
        .vaa-chart-col { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; justify-content: flex-end; gap: 6px; }
        .vaa-chart-bar { width: 100%; border-radius: 4px 4px 0 0; background: var(--role-venue, #22e5d4); min-height: 4px; }
        .vaa-chart-label { font-family: var(--font-mono); font-size: 10px; color: var(--ink-a50); }
        .vaa-empty { text-align: center; padding: 40px 24px; color: var(--ink-a50); border: 1px solid var(--line); border-radius: var(--radius-md); background: var(--bg2); margin-top: 12px; margin-bottom: 24px; font-size: 14px; }
        .vaa-events { border: 1px solid var(--line); border-radius: var(--radius-md); background: var(--bg2); margin-top: 12px; overflow: hidden; }
        .vaa-event-row { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--line); text-decoration: none; color: inherit; }
        .vaa-event-row:last-child { border-bottom: none; }
        .vaa-event-row:hover { background: var(--bg3); }
        .vaa-event-title { font-family: var(--font-display); font-weight: 800; font-size: 14px; color: var(--ink); }
        .vaa-event-meta { font-size: 12px; color: var(--ink-a60); margin-top: 2px; }
        .vaa-event-gross { font-family: var(--font-mono); font-size: 13px; color: var(--role-venue, #22e5d4); font-weight: 700; flex-shrink: 0; }
      `}</style>
    </div>
  );
}

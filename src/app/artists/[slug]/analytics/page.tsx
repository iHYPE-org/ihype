import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { canManageOwnedResource } from '@/lib/permissions';
import { formatCurrencyFromCents } from '@/lib/ticketing';
import { getDemoCreatorExclusion } from '@/lib/runtime-flags';

export const dynamic = 'force-dynamic';

const RANGES = ['7d', '30d', 'ytd'] as const;
type Range = (typeof RANGES)[number];
const RANGE_LABEL: Record<Range, string> = { '7d': '7 Days', '30d': '30 Days', ytd: 'YTD' };

function getRange(range: string | string[] | undefined): Range {
  if (typeof range === 'string' && (RANGES as readonly string[]).includes(range)) return range as Range;
  return '30d';
}

type BucketUnit = 'day' | 'week' | 'month';

/** Real date-window math for each range tab — no fabricated numbers, just boundaries. */
function getRangeWindow(range: Range) {
  const now = new Date();
  let start: Date;
  let bucketUnit: BucketUnit;

  if (range === '7d') {
    start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    bucketUnit = 'day';
  } else if (range === '30d') {
    start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    bucketUnit = 'day';
  } else {
    start = new Date(now.getFullYear(), 0, 1);
    bucketUnit = 'month';
  }

  // Prior period of identical duration, immediately preceding `start` — the
  // real basis for a "+X% this period" delta (never invented).
  const durationMs = now.getTime() - start.getTime();
  const prevStart = new Date(start.getTime() - durationMs);
  const prevEnd = start;

  return { start, end: now, prevStart, prevEnd, bucketUnit };
}

function bucketKey(date: Date, unit: BucketUnit): string {
  if (unit === 'day') return date.toISOString().slice(0, 10);
  if (unit === 'month') return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  // week: ISO-ish week bucket keyed by the Sunday that starts it
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().slice(0, 10);
}

function bucketLabel(key: string, unit: BucketUnit): string {
  if (unit === 'month') {
    const [y, m] = key.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short' });
  }
  return new Date(key).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function buildBuckets(start: Date, end: Date, unit: BucketUnit): string[] {
  const keys: string[] = [];
  const cursor = new Date(start);
  if (unit === 'day') {
    while (cursor <= end) {
      keys.push(bucketKey(cursor, unit));
      cursor.setDate(cursor.getDate() + 1);
    }
  } else if (unit === 'week') {
    while (cursor <= end) {
      keys.push(bucketKey(cursor, unit));
      cursor.setDate(cursor.getDate() + 7);
    }
  } else {
    cursor.setDate(1);
    while (cursor <= end) {
      keys.push(bucketKey(cursor, unit));
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }
  // de-dupe while preserving order (edge case: start === end)
  return Array.from(new Set(keys));
}

function pctDelta(current: number, previous: number): number | null {
  if (previous <= 0) return null; // no honest baseline to compare against
  return Math.round(((current - previous) / previous) * 100);
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const profile = await db.profile.findUnique({ where: { slug }, select: { name: true } });
  return {
    title: profile ? `Analytics · ${profile.name} · iHYPE` : 'Artist Analytics · iHYPE',
    robots: { index: false, follow: false },
  };
}

export default async function ArtistAnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const session = await auth();
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;

  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/artists/${slug}/analytics`);
  }

  const profile = await db.profile.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true, ownerId: true, type: true },
  });
  if (!profile || profile.type !== 'ARTIST') return notFound();

  const isOwner = canManageOwnedResource(session, profile.ownerId);
  if (!isOwner) return notFound();

  const range = getRange(resolvedSearchParams.range);
  const { start, end, prevStart, prevEnd, bucketUnit } = getRangeWindow(range);

  // Tracks belonging to this artist — needed to scope MediaListen (which is
  // keyed by mediaId, not profileId directly). Same join pattern as
  // getListenerStats in src/lib/profile-insights.ts.
  const assets = await db.artistMediaAsset.findMany({ where: { profileId: profile.id }, select: { hexId: true } });
  const hexIds = assets.map((a) => a.hexId);

  const [
    currentListens,
    previousListenerIds,
    currentTicketOrders,
    previousTicketAgg,
    currentHypeCount,
    previousHypeCount,
    topEventsShows,
  ] = await Promise.all([
    hexIds.length
      ? db.mediaListen.findMany({ where: { mediaId: { in: hexIds }, createdAt: { gte: start, lte: end } }, select: { userId: true, createdAt: true } })
      : Promise.resolve([]),
    hexIds.length
      ? db.mediaListen.findMany({ where: { mediaId: { in: hexIds }, createdAt: { gte: prevStart, lt: prevEnd } }, select: { userId: true }, distinct: ['userId'] })
      : Promise.resolve([]),
    db.ticketOrder.findMany({
      where: { status: 'CAPTURED', createdAt: { gte: start, lte: end }, show: { headlinerProfileId: profile.id, ...getDemoCreatorExclusion() } },
      select: { quantity: true, totalChargeCents: true, artistPayoutCents: true, showId: true },
    }),
    db.ticketOrder.aggregate({
      where: { status: 'CAPTURED', createdAt: { gte: prevStart, lt: prevEnd }, show: { headlinerProfileId: profile.id, ...getDemoCreatorExclusion() } },
      _sum: { quantity: true },
    }),
    db.profileHypeEvent.count({ where: { profileId: profile.id, createdAt: { gte: start, lte: end } } }),
    db.profileHypeEvent.count({ where: { profileId: profile.id, createdAt: { gte: prevStart, lt: prevEnd } } }),
    db.show.findMany({
      where: { headlinerProfileId: profile.id, ...getDemoCreatorExclusion() },
      select: {
        id: true, slug: true, title: true, startsAt: true, ticketCapacity: true,
        ticketOrders: { where: { status: 'CAPTURED', createdAt: { gte: start, lte: end } }, select: { quantity: true, totalChargeCents: true } },
      },
    }),
  ]);

  // Distinct listeners in the current window
  const distinctCurrentListeners = new Set(currentListens.map((l) => l.userId)).size;
  const distinctPreviousListeners = previousListenerIds.length;

  const currentTicketsSold = currentTicketOrders.reduce((sum, o) => sum + o.quantity, 0);
  const previousTicketsSold = previousTicketAgg._sum.quantity ?? 0;
  const grossArtistShareCents = currentTicketOrders.reduce((sum, o) => sum + o.artistPayoutCents, 0);

  const listenersDelta = pctDelta(distinctCurrentListeners, distinctPreviousListeners);
  const ticketsDelta = pctDelta(currentTicketsSold, previousTicketsSold);
  const hypeDelta = pctDelta(currentHypeCount, previousHypeCount);

  // Listeners-over-time bar chart — real MediaListen rows bucketed by
  // day/week/month depending on range, reusing the join pattern from
  // getListenerStats (src/lib/profile-insights.ts).
  const bucketKeys = buildBuckets(start, end, bucketUnit);
  const bucketCounts = new Map(bucketKeys.map((k) => [k, 0]));
  for (const listen of currentListens) {
    const key = bucketKey(listen.createdAt, bucketUnit);
    if (bucketCounts.has(key)) bucketCounts.set(key, (bucketCounts.get(key) ?? 0) + 1);
  }
  const chartBars = bucketKeys.map((k) => ({ label: bucketLabel(k, bucketUnit), count: bucketCounts.get(k) ?? 0 }));
  const maxBar = Math.max(1, ...chartBars.map((b) => b.count));
  const hasChartActivity = chartBars.some((b) => b.count > 0);

  // Top Events — real shows ranked by real ticket gross within the range.
  const topEvents = topEventsShows
    .map((show) => {
      const ticketsSold = show.ticketOrders.reduce((sum, o) => sum + o.quantity, 0);
      const grossCents = show.ticketOrders.reduce((sum, o) => sum + o.totalChargeCents, 0);
      return { slug: show.slug, title: show.title, startsAt: show.startsAt, ticketCapacity: show.ticketCapacity, ticketsSold, grossCents };
    })
    .filter((e) => e.ticketsSold > 0)
    .sort((a, b) => b.grossCents - a.grossCents)
    .slice(0, 5);

  return (
    <div className="aa-page">
      <div className="aa-header">
        <div>
          <div className="aa-eyebrow">Analytics</div>
          <h1 className="aa-title">{profile.name}</h1>
        </div>
      </div>

      <div className="aa-tabs">
        {RANGES.map((r) => (
          <Link className={r === range ? 'aa-tab active' : 'aa-tab'} href={`/artists/${profile.slug}/analytics?range=${r}`} key={r}>
            {RANGE_LABEL[r]}
          </Link>
        ))}
      </div>

      <div className="aa-stats-grid">
        <div className="aa-stat-card">
          <div className="aa-stat-label">Listeners</div>
          <div className="aa-stat-val">{distinctCurrentListeners.toLocaleString()}</div>
          <div className="aa-stat-sub" style={listenersDelta != null ? { color: 'var(--role-venue, #22e5d4)' } : undefined}>
            {listenersDelta != null ? `${listenersDelta >= 0 ? '+' : ''}${listenersDelta}% this period` : 'Distinct listeners'}
          </div>
        </div>
        <div className="aa-stat-card">
          <div className="aa-stat-label">Tickets Sold</div>
          <div className="aa-stat-val">{currentTicketsSold.toLocaleString()}</div>
          <div className="aa-stat-sub" style={ticketsDelta != null ? { color: 'var(--role-venue, #22e5d4)' } : undefined}>
            {ticketsDelta != null ? `${ticketsDelta >= 0 ? '+' : ''}${ticketsDelta}% this period` : 'CAPTURED orders'}
          </div>
        </div>
        <div className="aa-stat-card">
          <div className="aa-stat-label">Hype Cast</div>
          <div className="aa-stat-val">{currentHypeCount.toLocaleString()}</div>
          <div className="aa-stat-sub" style={hypeDelta != null ? { color: 'var(--role-venue, #22e5d4)' } : undefined}>
            {hypeDelta != null ? `${hypeDelta >= 0 ? '+' : ''}${hypeDelta}% this period` : 'Total hypes'}
          </div>
        </div>
        <div className="aa-stat-card">
          <div className="aa-stat-label">Gross (70% share)</div>
          <div className="aa-stat-val" style={{ color: 'var(--accent)' }}>{formatCurrencyFromCents(grossArtistShareCents)}</div>
          <div className="aa-stat-sub">$0 iHYPE fee</div>
        </div>
      </div>

      <div className="aa-eyebrow-row">
        <span className="aa-eyebrow-sm" style={{ color: 'var(--accent)' }}>Listeners over time</span>
      </div>
      {hasChartActivity ? (
        <div className="aa-chart">
          {chartBars.map((b, i) => (
            <div className="aa-bar" key={i} title={`${b.label}: ${b.count}`} style={{ height: `${Math.max(4, (b.count / maxBar) * 100)}%` }} />
          ))}
        </div>
      ) : (
        <div className="aa-empty" style={{ marginBottom: 32 }}><p>No listens yet in this period.</p></div>
      )}

      <div className="aa-eyebrow-row">
        <span className="aa-eyebrow-sm">Top Events</span>
      </div>
      {topEvents.length === 0 ? (
        <div className="aa-empty"><p>No events in this period yet.</p></div>
      ) : (
        <div className="aa-events-list">
          {topEvents.map((event) => {
            const date = event.startsAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            return (
              <Link className="aa-event-row" href={`/shows/${event.slug}`} key={event.slug}>
                <div style={{ minWidth: 0 }}>
                  <div className="aa-event-title">{event.title} · {date}</div>
                  <div className="aa-event-meta">
                    {event.ticketsSold.toLocaleString()} tickets{event.ticketCapacity ? ` · ${event.ticketCapacity.toLocaleString()} cap` : ''}
                  </div>
                </div>
                <span className="aa-event-gross">{formatCurrencyFromCents(event.grossCents)}</span>
              </Link>
            );
          })}
        </div>
      )}

      <style>{`
        .aa-page { max-width: 1000px; margin: 0 auto; padding: 40px 24px 100px; }
        .aa-header { display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 16px; margin-bottom: 20px; }
        .aa-eyebrow { font-family: var(--font-mono); font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: var(--ink-a50); margin-bottom: 6px; }
        .aa-title { font-family: var(--font-display); font-size: 28px; font-weight: 800; letter-spacing: -.02em; margin: 0; color: var(--ink); }
        .aa-tabs { display: flex; gap: 4px; margin-bottom: 28px; border: 1px solid var(--line); border-radius: var(--radius-pill); padding: 4px; width: fit-content; }
        .aa-tab { padding: 8px 18px; border-radius: var(--radius-pill); font-size: 13px; font-weight: 700; color: var(--ink-a60); text-decoration: none; }
        .aa-tab.active { background: var(--accent); color: #fff; }
        .aa-stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 32px; }
        .aa-stat-card { padding: 18px 20px; border-radius: var(--radius-lg); border: 1px solid var(--line); background: var(--bg2); }
        .aa-stat-label { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: .14em; color: var(--ink-a50); margin-bottom: 6px; }
        .aa-stat-val { font-family: var(--font-display); font-weight: 800; font-size: 24px; color: var(--ink); }
        .aa-stat-sub { font-size: 11.5px; color: var(--ink-a50); margin-top: 2px; }
        .aa-eyebrow-row { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 14px; }
        .aa-eyebrow-sm { font-family: var(--font-mono); font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: var(--ink-a50); }
        .aa-chart { display: flex; align-items: flex-end; gap: 6px; height: 100px; margin-bottom: 32px; padding: 0 4px; }
        .aa-bar { flex: 1; min-width: 2px; border-radius: 4px 4px 0 0; background: var(--accent); }
        .aa-empty { text-align: center; padding: 40px 24px; color: var(--ink-a50); border: 1px solid var(--line); border-radius: var(--radius-md); background: var(--bg2); }
        .aa-events-list { border: 1px solid var(--line); border-radius: var(--radius-md); background: var(--bg2); overflow: hidden; }
        .aa-event-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 16px 20px; border-bottom: 1px solid var(--line); text-decoration: none; color: inherit; }
        .aa-event-row:last-child { border-bottom: none; }
        .aa-event-row:hover { background: var(--bg3); }
        .aa-event-title { font-family: var(--font-display); font-weight: 800; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .aa-event-meta { font-size: 12px; color: var(--ink-a55); margin-top: 2px; }
        .aa-event-gross { font-family: var(--font-mono); font-size: 13px; color: var(--accent); font-weight: 700; flex-shrink: 0; }

        @media (max-width: 600px) {
          .aa-page { padding: 28px 20px 100px; }
        }
      `}</style>
    </div>
  );
}

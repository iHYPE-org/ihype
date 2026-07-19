import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { canManageOwnedResource } from '@/lib/permissions';
import { formatCurrencyFromCents } from '@/lib/ticketing';

export const metadata: Metadata = {
  title: 'DJ Analytics · iHYPE',
  robots: { index: false, follow: false },
};

const RANGES = ['7d', '30d', 'ytd'] as const;
type Range = (typeof RANGES)[number];
const RANGE_LABEL: Record<Range, string> = { '7d': '7 Days', '30d': '30 Days', ytd: 'YTD' };

function getRange(range: string | string[] | undefined): Range {
  if (typeof range === 'string' && (RANGES as readonly string[]).includes(range)) return range as Range;
  return '30d';
}

/**
 * Current-period start, and — where a same-length prior period is cheap and
 * meaningful — the prior period's [start, end) bounds for a "+X% this period"
 * delta. YTD has no sane fixed-length "prior period" (comparing partial-year
 * to partial-year), so it gets a raw current number, no delta, matching the
 * task's guidance to omit a comparison rather than fabricate one.
 */
function getRangeBounds(range: Range, now: Date) {
  if (range === '7d') {
    const start = new Date(now.getTime() - 7 * 86400000);
    const prevStart = new Date(now.getTime() - 14 * 86400000);
    return { start, prevStart, prevEnd: start };
  }
  if (range === '30d') {
    const start = new Date(now.getTime() - 30 * 86400000);
    const prevStart = new Date(now.getTime() - 60 * 86400000);
    return { start, prevStart, prevEnd: start };
  }
  const start = new Date(now.getFullYear(), 0, 1);
  return { start, prevStart: null, prevEnd: null };
}

function pctDelta(current: number, prior: number | null): string | null {
  if (prior === null) return null;
  if (prior === 0) return current > 0 ? '+new activity this period' : null;
  const pct = Math.round(((current - prior) / prior) * 100);
  if (pct === 0) return null;
  return `${pct > 0 ? '+' : ''}${pct}% this period`;
}

/** Buckets a list of dates into evenly-spaced bars across [start, now) for the "listeners over time" chart. */
function bucketDates(dates: Date[], start: Date, now: Date, bucketCount: number) {
  const spanMs = Math.max(1, now.getTime() - start.getTime());
  const buckets = new Array(bucketCount).fill(0);
  for (const d of dates) {
    const offset = d.getTime() - start.getTime();
    if (offset < 0 || offset >= spanMs) continue;
    const idx = Math.min(bucketCount - 1, Math.floor((offset / spanMs) * bucketCount));
    buckets[idx] += 1;
  }
  return buckets;
}

export default async function DJAnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ range?: string }>;
}) {
  const { slug } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/promoters/${slug}/analytics`);
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const range = getRange(resolvedSearchParams.range);

  const profile = await db.profile.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true, ownerId: true, type: true },
  });
  if (!profile || profile.type !== 'DJ') return notFound();

  const isOwner = canManageOwnedResource(session, profile.ownerId);
  if (!isOwner) return notFound();

  const now = new Date();
  const { start, prevStart, prevEnd } = getRangeBounds(range, now);
  const bucketCount = range === '7d' ? 7 : range === '30d' ? 10 : 12;

  const showWhere = { promoterProfileId: profile.id };

  const [
    currentListens,
    priorListenerCount,
    showsAiredCurrent,
    showsAiredPrior,
    hypeCastCurrent,
    hypeCastPrior,
    earningsCurrentAgg,
    earningsPriorAgg,
    topShows,
  ] = await Promise.all([
    // Real ShowListen rows (on-demand replay listens) for this DJ's shows in the current period — used for both the "Listeners" stat and the chart buckets.
    db.showListen.findMany({
      where: { show: showWhere, createdAt: { gte: start } },
      select: { userId: true, createdAt: true },
    }),
    prevStart
      ? db.showListen.findMany({
          where: { show: showWhere, createdAt: { gte: prevStart, lt: prevEnd! } },
          select: { userId: true },
          distinct: ['userId'],
        })
      : Promise.resolve(null),
    db.show.count({ where: { ...showWhere, status: 'ENDED', startsAt: { gte: start } } }),
    prevStart
      ? db.show.count({ where: { ...showWhere, status: 'ENDED', startsAt: { gte: prevStart, lt: prevEnd! } } })
      : Promise.resolve(null),
    db.hypeEvent.count({ where: { show: showWhere, createdAt: { gte: start } } }),
    prevStart
      ? db.hypeEvent.count({ where: { show: showWhere, createdAt: { gte: prevStart, lt: prevEnd! } } })
      : Promise.resolve(null),
    db.ticketOrder.aggregate({
      where: { affiliatePromoterProfileId: profile.id, status: { in: ['CAPTURED', 'RESERVED'] }, createdAt: { gte: start } },
      _sum: { promoterPayoutCents: true },
    }),
    prevStart
      ? db.ticketOrder.aggregate({
          where: { affiliatePromoterProfileId: profile.id, status: { in: ['CAPTURED', 'RESERVED'] }, createdAt: { gte: prevStart, lt: prevEnd! } },
          _sum: { promoterPayoutCents: true },
        })
      : Promise.resolve(null),
    // Top shows this period, ranked by real hype count (a persisted per-show HypeEvent tally) —
    // there is no "peak concurrent listeners" field anywhere in the schema (live listener counts
    // aren't persisted), so that design-mock metric is intentionally not reproduced here.
    db.show.findMany({
      where: { ...showWhere, startsAt: { gte: start } },
      orderBy: { hypes: { _count: 'desc' } },
      take: 5,
      select: {
        slug: true,
        title: true,
        startsAt: true,
        hypeCount: true,
        _count: { select: { showListens: true } },
        radioTracks: { select: { id: true } },
      },
    }),
  ]);

  const distinctCurrentListeners = new Set(currentListens.map((l) => l.userId)).size;
  const listenersDelta = pctDelta(distinctCurrentListeners, priorListenerCount ? priorListenerCount.length : null);

  const showsAiredDelta = pctDelta(showsAiredCurrent, showsAiredPrior);
  const hypeCastDelta = pctDelta(hypeCastCurrent, hypeCastPrior);

  const earningsCurrentCents = earningsCurrentAgg._sum.promoterPayoutCents ?? 0;
  const earningsPriorCents = earningsPriorAgg ? earningsPriorAgg._sum.promoterPayoutCents ?? 0 : null;
  const earningsDelta = pctDelta(earningsCurrentCents, earningsPriorCents);

  const listenerChartBuckets = bucketDates(
    currentListens.map((l) => l.createdAt),
    start,
    now,
    bucketCount
  );
  const maxBucket = Math.max(1, ...listenerChartBuckets);

  const stats = [
    { label: 'Listeners', value: distinctCurrentListeners.toLocaleString(), delta: listenersDelta },
    { label: 'Shows Aired', value: showsAiredCurrent.toLocaleString(), delta: showsAiredDelta },
    { label: 'Hype Cast', value: hypeCastCurrent.toLocaleString(), delta: hypeCastDelta },
    { label: 'Promoter Earnings', value: formatCurrencyFromCents(earningsCurrentCents), delta: earningsDelta, sub: '10% pool share', accent: true },
  ];

  return (
    <div className="dja-page">
      <div className="dja-header">
        <div>
          <div className="dja-eyebrow">{profile.name}</div>
          <h1 className="dja-title">Analytics</h1>
        </div>
        <div className="dja-header-actions">
          <Link className="dja-btn" href={`/promoters/${profile.slug}/dashboard`}>Dashboard</Link>
          <Link className="dja-btn" href={`/promoters/${profile.slug}`}>My Page</Link>
        </div>
      </div>

      <div className="dja-tabs">
        {RANGES.map((r) => (
          <Link
            className={r === range ? 'dja-tab active' : 'dja-tab'}
            href={`/promoters/${profile.slug}/analytics?range=${r}`}
            key={r}
          >
            {RANGE_LABEL[r]}
          </Link>
        ))}
      </div>

      <div className="dja-stat-grid">
        {stats.map((s) => (
          <div className="dja-card" key={s.label}>
            <div className="dja-stat-label">{s.label}</div>
            <div className="dja-stat-value" style={s.accent ? { color: '#ff3e9a' } : undefined}>{s.value}</div>
            <div className="dja-stat-sub" style={s.delta ? { color: '#ff3e9a' } : undefined}>{s.delta ?? s.sub ?? ''}</div>
          </div>
        ))}
      </div>

      <div className="dja-section-eyebrow" style={{ color: '#ff3e9a' }}>Listeners over time</div>
      {distinctCurrentListeners > 0 ? (
        <div className="dja-chart">
          {listenerChartBuckets.map((count, i) => (
            <div
              className="dja-bar"
              key={i}
              title={`${count} listen${count === 1 ? '' : 's'}`}
              style={{ height: `${Math.max(4, (count / maxBucket) * 100)}%`, opacity: count > 0 ? 0.9 : 0.15 }}
            />
          ))}
        </div>
      ) : (
        <div className="dja-empty"><p>No listens yet in this period.</p></div>
      )}

      <div className="dja-eyebrow-row">
        <span className="dja-section-eyebrow">Top Shows</span>
      </div>
      {topShows.length === 0 ? (
        <div className="dja-empty"><p>No shows aired in this period yet.</p></div>
      ) : (
        <div className="dja-show-list">
          {topShows.map((s) => (
            <Link className="dja-show-row" href={`/shows/${s.slug}`} key={s.slug}>
              <div>
                <div className="dja-show-title">
                  {s.title} · {s.startsAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
                <div className="dja-show-meta">
                  {s._count.showListens} listener{s._count.showListens === 1 ? '' : 's'} · {s.radioTracks.length} track{s.radioTracks.length === 1 ? '' : 's'}
                </div>
              </div>
              <span className="dja-show-hypes">{s.hypeCount.toLocaleString()} hypes</span>
            </Link>
          ))}
        </div>
      )}

      <div className="dja-note">
        <div className="dja-note-eyebrow">Where your promoter earnings come from</div>
        <p>
          Your share of the 10% promoter pool scales with how much of an event&apos;s ticket sales trace back to
          your HYPE Links — locked in our charter.
        </p>
      </div>

      <style>{`
        .dja-page { max-width: 1000px; margin: 0 auto; padding: 40px 24px 80px; }
        .dja-header { display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 16px; margin-bottom: 20px; }
        .dja-eyebrow { font-family: var(--font-mono); font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: var(--ink-a50); margin-bottom: 6px; }
        .dja-title { font-family: var(--font-display); font-size: 28px; font-weight: 800; letter-spacing: -.02em; margin: 0; color: var(--ink); }
        .dja-header-actions { display: flex; gap: 10px; }
        .dja-btn { display: inline-flex; align-items: center; justify-content: center; padding: 10px 18px; border-radius: var(--radius-md, 12px); font-size: 13px; font-weight: 700; text-decoration: none; background: var(--bg2); color: var(--ink); border: 1px solid var(--hair-100); }
        .dja-btn:hover { background: var(--bg3); }
        .dja-tabs { display: flex; gap: 8px; margin-bottom: 28px; }
        .dja-tab { padding: 8px 16px; border-radius: var(--radius-pill, 999px); font-size: 13px; font-weight: 600; text-decoration: none; color: var(--ink-a60); border: 1px solid var(--hair-100); background: var(--bg2); }
        .dja-tab.active { color: #fff; background: #ff3e9a; border-color: transparent; }
        .dja-stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 32px; }
        .dja-card { border: 1px solid var(--line); border-radius: var(--radius-lg, 18px); background: var(--bg2); padding: 18px 20px; }
        .dja-stat-label { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: .14em; color: var(--ink-a50); margin-bottom: 6px; }
        .dja-stat-value { font-family: var(--font-display); font-weight: 800; font-size: 24px; color: var(--ink); }
        .dja-stat-sub { font-size: 11.5px; color: var(--ink-a50); margin-top: 2px; min-height: 14px; }
        .dja-section-eyebrow { font-family: var(--font-mono); font-size: 12px; text-transform: uppercase; letter-spacing: .12em; color: var(--ink-a50); }
        .dja-eyebrow-row { display: flex; justify-content: space-between; align-items: baseline; margin-top: 28px; }
        .dja-chart { display: flex; align-items: flex-end; gap: 6px; height: 100px; margin: 14px 0 32px; padding: 0 4px; }
        .dja-bar { flex: 1; border-radius: 4px 4px 0 0; background: #ff3e9a; }
        .dja-empty { text-align: center; padding: 40px 24px; color: var(--ink-a50); border: 1px solid var(--line); border-radius: var(--radius-md, 10px); background: var(--bg2); margin: 12px 0 28px; }
        .dja-show-list { border: 1px solid var(--line); border-radius: var(--radius-md, 10px); background: var(--bg2); margin-top: 12px; margin-bottom: 28px; }
        .dja-show-row { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--line); text-decoration: none; color: inherit; }
        .dja-show-row:last-child { border-bottom: none; }
        .dja-show-row:hover { background: var(--bg3); }
        .dja-show-title { font-family: var(--font-display); font-weight: 800; font-size: 14px; color: var(--ink); }
        .dja-show-meta { font-size: 12px; color: var(--ink-a55); margin-top: 2px; }
        .dja-show-hypes { font-family: var(--font-mono); font-size: 13px; color: #ff3e9a; font-weight: 700; flex-shrink: 0; }
        .dja-note { margin-top: 24px; padding: 14px 16px; border-radius: var(--radius-md, 10px); border: 1px solid var(--hair-100); background: var(--bg2); }
        .dja-note-eyebrow { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: .08em; text-transform: uppercase; color: var(--ink-a50); margin-bottom: 4px; }
        .dja-note p { font-size: 12.5px; color: var(--ink-a55); line-height: 1.6; margin: 0; }
      `}</style>
    </div>
  );
}

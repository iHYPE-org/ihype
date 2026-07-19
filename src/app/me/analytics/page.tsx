import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getPromoterDashboard } from '@/lib/promoterDashboard';
import { formatCurrencyFromCents } from '@/lib/ticketing';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Your Activity · iHYPE',
  robots: { index: false, follow: false },
};

type RangeId = '7d' | '30d' | 'ytd';
const RANGE_TABS: { id: RangeId; label: string }[] = [
  { id: '7d', label: '7 Days' },
  { id: '30d', label: '30 Days' },
  { id: 'ytd', label: 'YTD' },
];

function rangeStart(range: RangeId, now: Date): Date {
  if (range === '7d') return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (range === 'ytd') return new Date(now.getFullYear(), 0, 1);
  return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
}

type Bucket = { label: string; start: Date; end: Date; count: number };

/** Buckets a range into a small number of bars: daily for 7d, weekly for 30d, monthly for YTD. */
function buildBuckets(range: RangeId, start: Date, now: Date): Bucket[] {
  const buckets: Bucket[] = [];
  if (range === '7d') {
    for (let i = 6; i >= 0; i--) {
      const dayEnd = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dayStart = new Date(dayEnd.getTime() - 24 * 60 * 60 * 1000);
      buckets.push({
        label: dayStart.toLocaleDateString('en-US', { weekday: 'short' }),
        start: dayStart,
        end: dayEnd,
        count: 0,
      });
    }
  } else if (range === '30d') {
    const chunkMs = 7 * 24 * 60 * 60 * 1000;
    const totalMs = now.getTime() - start.getTime();
    const chunks = Math.max(1, Math.ceil(totalMs / chunkMs));
    for (let i = 0; i < chunks; i++) {
      const chunkStart = new Date(start.getTime() + i * chunkMs);
      const chunkEnd = new Date(Math.min(chunkStart.getTime() + chunkMs, now.getTime()));
      buckets.push({
        label: chunkStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        start: chunkStart,
        end: chunkEnd,
        count: 0,
      });
    }
  } else {
    // YTD: one bucket per calendar month so far this year.
    for (let m = 0; m <= now.getMonth(); m++) {
      const monthStart = new Date(now.getFullYear(), m, 1);
      const monthEnd = new Date(now.getFullYear(), m + 1, 1);
      buckets.push({
        label: monthStart.toLocaleDateString('en-US', { month: 'short' }),
        start: monthStart,
        end: monthEnd > now ? now : monthEnd,
        count: 0,
      });
    }
  }
  return buckets;
}

export default async function FanAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?callbackUrl=/me/analytics');

  const userId = session.user.id;
  const { range: rawRange } = await searchParams;
  const range: RangeId = rawRange === '7d' || rawRange === 'ytd' ? rawRange : '30d';

  const now = new Date();
  const start = rangeStart(range, now);
  // Prior period of the same length, for the Hype Cast "+X this period" delta.
  const priorStart = new Date(start.getTime() - (now.getTime() - start.getTime()));

  const [
    hypeCastCurrent,
    hypeCastPrior,
    showsAttended,
    promoterDashboard,
    hypesInRangeWithArtist,
  ] = await Promise.all([
    // Real count of HypeEvent rows this user cast in the selected range.
    db.hypeEvent.count({ where: { userId, createdAt: { gte: start, lte: now } } }),
    // Same window, shifted back — the only cheap real basis for a period delta.
    db.hypeEvent.count({ where: { userId, createdAt: { gte: priorStart, lt: start } } }),
    // Real count of captured ticket orders for shows that already happened,
    // within the selected range — "Shows Attended".
    db.ticketOrder.count({
      where: {
        buyerUserId: userId,
        status: 'CAPTURED',
        show: { startsAt: { gte: start, lte: now } },
      },
    }),
    // Reuses the real promoter/referral dashboard — earnedCents is exactly the
    // "Referral Earned" stat (lifetime; getPromoterDashboard has no range
    // parameter, so this is not scoped to the selected range).
    getPromoterDashboard(userId),
    // Backs both the "hype cast over time" chart and the "Top Artists" list —
    // one real query, bucketed/grouped in JS below.
    db.hypeEvent.findMany({
      where: { userId, createdAt: { gte: start, lte: now } },
      select: {
        createdAt: true,
        show: {
          select: {
            headlinerProfile: { select: { id: true, slug: true, name: true, genre: true, city: true } },
          },
        },
      },
    }),
  ]);

  const hypeDelta = hypeCastCurrent - hypeCastPrior;

  const buckets = buildBuckets(range, start, now);
  for (const h of hypesInRangeWithArtist) {
    const bucket = buckets.find((b) => h.createdAt >= b.start && h.createdAt < b.end) ?? buckets[buckets.length - 1];
    if (bucket) bucket.count += 1;
  }
  const maxBucketCount = Math.max(1, ...buckets.map((b) => b.count));

  const artistCounts = new Map<string, { slug: string; name: string; genre: string | null; city: string | null; count: number }>();
  for (const h of hypesInRangeWithArtist) {
    const artist = h.show.headlinerProfile;
    if (!artist) continue;
    const existing = artistCounts.get(artist.id);
    if (existing) {
      existing.count += 1;
    } else {
      artistCounts.set(artist.id, { slug: artist.slug, name: artist.name, genre: artist.genre, city: artist.city, count: 1 });
    }
  }
  const topArtists = Array.from(artistCounts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return (
    <div className="fa-page">
      <h1 className="fa-title">Your Activity</h1>

      <div className="fa-tabs">
        {RANGE_TABS.map((tab) => (
          <Link
            key={tab.id}
            href={tab.id === '30d' ? '/me/analytics' : `/me/analytics?range=${tab.id}`}
            className={`fa-tab${tab.id === range ? ' fa-tab-active' : ''}`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <div className="fa-stats-grid">
        {/* NOTE: no "Listening Streak" card — nothing in the schema tracks
            daily listen streaks (no field/model for it). Omitted rather than
            fabricated, same as src/app/me/dashboard/page.tsx. */}
        <Link className="fa-stat-card" href="/tickets">
          <div className="fa-stat-label">Hype Cast</div>
          <div className="fa-stat-val">{hypeCastCurrent.toLocaleString()}</div>
          <div className="fa-stat-sub" style={{ color: hypeDelta !== 0 ? 'var(--role-fan, #b983ff)' : undefined }}>
            {hypeDelta > 0 ? `+${hypeDelta}` : hypeDelta} this period
          </div>
        </Link>
        <div className="fa-stat-card">
          <div className="fa-stat-label">Shows Attended</div>
          <div className="fa-stat-val">{showsAttended.toLocaleString()}</div>
          <div className="fa-stat-sub">This period</div>
        </div>
        <div className="fa-stat-card">
          <div className="fa-stat-label">Referral Earned</div>
          <div className="fa-stat-val" style={{ color: 'var(--role-fan, #b983ff)' }}>
            {formatCurrencyFromCents(promoterDashboard.earnedCents)}
          </div>
          <div className="fa-stat-sub">From your HYPE Link (lifetime, pending settlement)</div>
        </div>
      </div>

      <div className="fa-eyebrow">Hype cast over time</div>
      <div className="fa-chart">
        {buckets.map((b, i) => (
          <div className="fa-chart-bar-wrap" key={i} title={`${b.label}: ${b.count}`}>
            <div
              className="fa-chart-bar"
              style={{ height: `${Math.max(4, (b.count / maxBucketCount) * 100)}%` }}
            />
            <div className="fa-chart-bar-label">{b.label}</div>
          </div>
        ))}
      </div>

      <div className="fa-section-head">
        <span className="fa-eyebrow-sm">Top Artists</span>
      </div>
      {topArtists.length === 0 ? (
        <div className="fa-empty">
          <p>No hype activity in this period yet.</p>
        </div>
      ) : (
        <div className="fa-artist-list">
          {topArtists.map((artist) => (
            <Link className="fa-artist-row" href={`/artists/${artist.slug}`} key={artist.slug}>
              <div>
                <div className="fa-artist-name">{artist.name}</div>
                <div className="fa-artist-meta">
                  {[artist.genre, artist.city].filter(Boolean).join(' · ') || ' '}
                </div>
              </div>
              <span className="fa-artist-count">{artist.count} hype{artist.count === 1 ? '' : 's'}</span>
            </Link>
          ))}
        </div>
      )}

      <style>{`
        .fa-page { max-width: 1000px; margin: 0 auto; padding: 40px 24px 80px; }
        .fa-title { font-family: var(--font-display); font-size: 28px; font-weight: 800; letter-spacing: -.02em; margin: 0 0 20px; color: var(--ink); }
        .fa-tabs { display: flex; gap: 4px; border: 1px solid var(--line); border-radius: var(--radius-pill, 9999px); padding: 4px; width: fit-content; margin-bottom: 28px; }
        .fa-tab { font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: .08em; padding: 8px 16px; border-radius: var(--radius-pill, 9999px); color: var(--ink-a50); text-decoration: none; }
        .fa-tab:hover { color: var(--ink); }
        .fa-tab-active { background: var(--role-fan, #b983ff); color: #fff; }
        .fa-stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 32px; }
        .fa-stat-card { display: block; text-decoration: none; padding: 18px 20px; border: 1px solid var(--line); border-radius: var(--radius-md, 12px); background: var(--bg2); color: inherit; }
        .fa-stat-label { font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; letter-spacing: .14em; color: var(--ink-a50); margin-bottom: 6px; }
        .fa-stat-val { font-family: var(--font-display); font-weight: 800; font-size: 24px; color: var(--ink); }
        .fa-stat-sub { font-size: 11.5px; color: var(--ink-a50); margin-top: 2px; }
        .fa-eyebrow { font-family: var(--font-mono); font-size: 12px; text-transform: uppercase; letter-spacing: .14em; color: var(--role-fan, #b983ff); margin-bottom: 4px; }
        .fa-chart { display: flex; align-items: flex-end; gap: 6px; height: 120px; margin: 14px 0 32px; padding: 0 4px; overflow-x: auto; }
        .fa-chart-bar-wrap { flex: 1; min-width: 24px; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; gap: 6px; }
        .fa-chart-bar { width: 100%; border-radius: 4px 4px 0 0; background: var(--role-fan, #b983ff); }
        .fa-chart-bar-label { font-family: var(--font-mono); font-size: 9px; color: var(--ink-a50); white-space: nowrap; }
        .fa-section-head { display: flex; justify-content: space-between; align-items: baseline; }
        .fa-eyebrow-sm { font-family: var(--font-mono); font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: var(--ink-a50); }
        .fa-empty { text-align: center; padding: 40px 24px; color: var(--ink-a50); border: 1px solid var(--line); border-radius: var(--radius-md, 10px); background: var(--bg2); margin-top: 12px; }
        .fa-artist-list { border: 1px solid var(--line); border-radius: var(--radius-md, 10px); background: var(--bg2); margin-top: 12px; overflow: hidden; }
        .fa-artist-row { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; text-decoration: none; color: inherit; border-bottom: 1px solid var(--line); }
        .fa-artist-row:last-child { border-bottom: none; }
        .fa-artist-row:hover { background: var(--bg3); }
        .fa-artist-name { font-family: var(--font-display); font-weight: 800; font-size: 14px; color: var(--ink); }
        .fa-artist-meta { font-size: 12px; color: var(--ink-a55); margin-top: 2px; }
        .fa-artist-count { font-family: var(--font-mono); font-size: 13px; color: var(--role-fan, #b983ff); font-weight: 700; }
      `}</style>
    </div>
  );
}

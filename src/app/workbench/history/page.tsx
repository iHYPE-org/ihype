import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const metadata: Metadata = { title: 'Your History · iHYPE Workbench' };
export const dynamic = 'force-dynamic';

type Period = 'week' | 'month' | 'year' | 'all';

const PERIOD_LABELS: Record<Period, string> = {
  week: 'Last 7 days',
  month: 'Last 30 days',
  year: 'Last year',
  all: 'All time'
};

function periodStart(period: Period): Date | null {
  const now = Date.now();
  if (period === 'week')  return new Date(now - 7  * 86_400_000);
  if (period === 'month') return new Date(now - 30 * 86_400_000);
  if (period === 'year')  return new Date(now - 365 * 86_400_000);
  return null;
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="panel" style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.45 }}>{label}</div>
      <div style={{ fontSize: '1.6rem', fontWeight: 800, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: '0.7rem', opacity: 0.5 }}>{sub}</div>}
    </div>
  );
}

function MiniBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent, #ff5029)', borderRadius: 3, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: '0.68rem', opacity: 0.55, minWidth: 20, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function ActivityChart({ data, label }: { data: { label: string; value: number }[]; label: string }) {
  const max = Math.max(1, ...data.map(d => d.value));
  return (
    <div>
      <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.07em', opacity: 0.4, marginBottom: '0.5rem' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 48 }}>
        {data.map((d, i) => (
          <div key={i} title={`${d.label}: ${d.value}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <div style={{ width: '100%', background: d.value > 0 ? 'var(--accent, #ff5029)' : 'rgba(255,255,255,0.08)', borderRadius: '2px 2px 0 0', height: `${Math.max(2, (d.value / max) * 44)}px`, transition: 'height 0.2s' }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function HistoryPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/auth/landing');
  const userId = session.user.id;

  const sp = await searchParams;
  const period = (['week', 'month', 'year', 'all'].includes(sp.period ?? '') ? sp.period : 'month') as Period;
  const since = periodStart(period);
  const dateFilter = since ? { gte: since } : undefined;

  // ── Fetch all data in parallel ────────────────────────────────────────────
  const [listens, hypes, seeds, follows] = await Promise.all([
    db.mediaListen.findMany({
      where: { userId, ...(dateFilter ? { createdAt: dateFilter } : {}) },
      select: { mediaId: true, title: true, artistName: true, artistProfileSlug: true, createdAt: true },
      orderBy: { createdAt: 'desc' }
    }),
    db.profileHypeEvent.findMany({
      where: { userId, ...(dateFilter ? { createdAt: dateFilter } : {}) },
      select: { profileId: true, createdAt: true, profile: { select: { name: true, slug: true, avatarImage: true, genres: true, type: true } } },
      orderBy: { createdAt: 'desc' }
    }),
    db.seed.findMany({
      where: { userId, ...(dateFilter ? { createdAt: dateFilter } : {}) },
      select: { mediaId: true, action: true, createdAt: true },
      orderBy: { createdAt: 'desc' }
    }),
    db.follow.findMany({
      where: { followerId: userId, ...(dateFilter ? { createdAt: dateFilter } : {}) },
      select: { createdAt: true },
      orderBy: { createdAt: 'desc' }
    })
  ]);

  // ── Derived stats ─────────────────────────────────────────────────────────
  const totalListens = listens.length;
  const totalHypes = hypes.length;
  const uniqueArtistsListened = new Set(listens.map(l => l.artistName)).size;
  const uniqueArtistsHyped = new Set(hypes.map(h => h.profileId)).size;
  const savedCount = seeds.filter(s => s.action === 'save').length;
  const skippedCount = seeds.filter(s => s.action === 'skip').length;
  const followCount = follows.length;

  // Top tracks (by mediaId — since MediaListen is one-per-track, show most recent completions)
  const recentTracks = listens.slice(0, 20);

  // Top artists (hyped most recently, deduped by profileId)
  const seenProfiles = new Set<string>();
  const topArtists = hypes
    .filter(h => { if (seenProfiles.has(h.profileId)) return false; seenProfiles.add(h.profileId); return true; })
    .slice(0, 10);

  // Genre breakdown from hyped artists
  const genreCounts = new Map<string, number>();
  for (const h of hypes) {
    for (const g of h.profile.genres) {
      const key = g.toLowerCase();
      genreCounts.set(key, (genreCounts.get(key) ?? 0) + 1);
    }
  }
  const topGenres = [...genreCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const maxGenreCount = topGenres[0]?.[1] ?? 1;

  // Artist type breakdown
  const typeCounts = new Map<string, number>();
  for (const h of hypes) {
    const t = h.profile.type;
    typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1);
  }

  // Activity timeline — group by day (last 30 days) or week (year/all)
  const useWeekly = period === 'year' || period === 'all';
  function bucketKey(date: Date): string {
    if (useWeekly) {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      const dayOfWeek = d.getDay();
      d.setDate(d.getDate() - dayOfWeek);
      return d.toISOString().slice(0, 10);
    }
    return date.toISOString().slice(0, 10);
  }

  const listensByBucket = new Map<string, number>();
  const hypesByBucket = new Map<string, number>();

  for (const l of listens) {
    const k = bucketKey(l.createdAt);
    listensByBucket.set(k, (listensByBucket.get(k) ?? 0) + 1);
  }
  for (const h of hypes) {
    const k = bucketKey(h.createdAt);
    hypesByBucket.set(k, (hypesByBucket.get(k) ?? 0) + 1);
  }

  // Build a sorted array of all bucket keys
  const allBuckets = [...new Set([...listensByBucket.keys(), ...hypesByBucket.keys()])].sort();
  // Cap chart at 28 buckets for readability
  const chartBuckets = allBuckets.slice(-28);
  const listenChartData = chartBuckets.map(k => ({ label: k, value: listensByBucket.get(k) ?? 0 }));
  const hypeChartData = chartBuckets.map(k => ({ label: k, value: hypesByBucket.get(k) ?? 0 }));

  // Streak: consecutive days with at least one listen or hype (most recent streak)
  const activityDays = new Set([
    ...listens.map(l => l.createdAt.toISOString().slice(0, 10)),
    ...hypes.map(h => h.createdAt.toISOString().slice(0, 10))
  ]);
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if (activityDays.has(d.toISOString().slice(0, 10))) { streak++; } else { break; }
  }

  return (
    <main className="wb-main">
      <div className="wb-content" style={{ maxWidth: 900, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ marginBottom: '0.25rem' }}>Your history</h1>
          <p className="meta" style={{ marginBottom: '1rem' }}>A retrospective of your listening and discovery activity.</p>

          {/* Period selector */}
          <nav style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
              <Link
                key={p}
                href={`/workbench/history?period=${p}`}
                className={`button small${period === p ? '' : ' secondary'}`}
              >
                {PERIOD_LABELS[p]}
              </Link>
            ))}
          </nav>
        </div>

        {/* Overview stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <Stat label="Tracks completed" value={totalListens} />
          <Stat label="Artists explored" value={uniqueArtistsListened} sub="via listening" />
          <Stat label="Artists hyped" value={uniqueArtistsHyped} />
          <Stat label="Tracks saved" value={savedCount} />
          <Stat label="Tracks skipped" value={skippedCount} />
          <Stat label="New follows" value={followCount} />
          {streak > 1 && <Stat label="Active streak" value={`${streak}d`} sub="consecutive days" />}
        </div>

        {/* Activity timeline */}
        {chartBuckets.length > 1 && (
          <div className="panel" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.07em', opacity: 0.5, marginTop: 0, marginBottom: '1rem' }}>
              Activity {useWeekly ? '(by week)' : '(by day)'}
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <ActivityChart data={listenChartData} label="Listens" />
              <ActivityChart data={hypeChartData} label="Hypes" />
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>

          {/* Top genres */}
          {topGenres.length > 0 && (
            <div className="panel" style={{ padding: '1rem 1.25rem' }}>
              <h2 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.07em', opacity: 0.5, marginTop: 0, marginBottom: '0.75rem' }}>
                Top genres
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {topGenres.map(([genre, count]) => (
                  <div key={genre}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: '0.78rem', textTransform: 'capitalize' }}>{genre}</span>
                    </div>
                    <MiniBar value={count} max={maxGenreCount} label={genre} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Artists hyped */}
          {topArtists.length > 0 && (
            <div className="panel" style={{ padding: '1rem 1.25rem' }}>
              <h2 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.07em', opacity: 0.5, marginTop: 0, marginBottom: '0.75rem' }}>
                Artists you hyped
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {topArtists.map((h, i) => (
                  <Link
                    key={h.profileId}
                    href={`/artists/${h.profile.slug}`}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: 'inherit', padding: '4px 0' }}
                  >
                    <span style={{ fontSize: '0.6rem', opacity: 0.35, width: 14, textAlign: 'right' }}>{i + 1}</span>
                    {h.profile.avatarImage ? (
                      <img src={h.profile.avatarImage} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent, #ff5029)', opacity: 0.3, flexShrink: 0 }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.profile.name}</div>
                      <div style={{ fontSize: '0.65rem', opacity: 0.45 }}>{h.profile.type}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Artist type breakdown */}
          {typeCounts.size > 0 && (
            <div className="panel" style={{ padding: '1rem 1.25rem' }}>
              <h2 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.07em', opacity: 0.5, marginTop: 0, marginBottom: '0.75rem' }}>
                Who you hype
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[...typeCounts.entries()].sort((a, b) => b[1] - a[1]).map(([type, count]) => {
                  const max = Math.max(...typeCounts.values());
                  return (
                    <div key={type}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontSize: '0.78rem', textTransform: 'capitalize' }}>{type.charAt(0) + type.slice(1).toLowerCase()}{count === 1 ? '' : 's'}</span>
                      </div>
                      <MiniBar value={count} max={max} label={type} />
                    </div>
                  );
                })}
              </div>
              {savedCount > 0 || skippedCount > 0 ? (
                <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.07em', opacity: 0.4, marginBottom: '0.5rem' }}>Discover feed</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {savedCount > 0 && <MiniBar value={savedCount} max={Math.max(savedCount, skippedCount)} label="Saved" />}
                    {skippedCount > 0 && <MiniBar value={skippedCount} max={Math.max(savedCount, skippedCount)} label="Skipped" />}
                  </div>
                  <div style={{ fontSize: '0.65rem', opacity: 0.4, marginTop: 6 }}>
                    {savedCount} saved · {skippedCount} skipped
                    {savedCount + skippedCount > 0 ? ` · ${Math.round(savedCount / (savedCount + skippedCount) * 100)}% save rate` : ''}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Recent tracks */}
        {recentTracks.length > 0 && (
          <div className="panel" style={{ padding: '1rem 1.25rem', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.07em', opacity: 0.5, marginTop: 0, marginBottom: '0.75rem' }}>
              Tracks completed ({totalListens} total)
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {recentTracks.map((l, i) => (
                <div key={`${l.mediaId}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: i < recentTracks.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                  <span style={{ fontSize: '0.6rem', opacity: 0.3, width: 16, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.title}</div>
                    <div style={{ fontSize: '0.68rem', opacity: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {l.artistProfileSlug ? (
                        <Link href={`/artists/${l.artistProfileSlug}`} style={{ color: 'inherit', textDecoration: 'none', opacity: 0.8 }}>{l.artistName}</Link>
                      ) : l.artistName}
                    </div>
                  </div>
                  <span style={{ fontSize: '0.62rem', opacity: 0.3, flexShrink: 0 }}>
                    {l.createdAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              ))}
              {totalListens > 20 && (
                <p className="meta" style={{ fontSize: '0.72rem', marginTop: '0.5rem', opacity: 0.5 }}>
                  Showing 20 of {totalListens} completed tracks.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Empty state */}
        {totalListens === 0 && totalHypes === 0 && (
          <div className="empty">
            <span className="empty-title">No activity yet {period !== 'all' ? `in the ${PERIOD_LABELS[period].toLowerCase()}` : ''}.</span>
            <p>Start exploring artists and the data will show up here.</p>
            <Link href="/discover" className="button">Go to Discover</Link>
          </div>
        )}

      </div>
    </main>
  );
}

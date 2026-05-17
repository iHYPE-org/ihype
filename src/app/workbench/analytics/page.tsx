import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isAdminSession } from '@/lib/permissions';

export const metadata: Metadata = { title: 'Analytics · iHYPE' };
export const dynamic = 'force-dynamic';

function BarChart({ data, label }: { data: { label: string; value: number }[]; label: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="panel" style={{ padding: '1rem' }}>
      <h3 style={{ marginTop: 0 }}>{label}</h3>
      {data.length === 0 ? (
        <div className="empty">No data yet.</div>
      ) : (
        <svg viewBox={`0 0 ${data.length * 18} 100`} width="100%" height={120} aria-label={label}>
          {data.map((d, i) => {
            const h = (d.value / max) * 90;
            return (
              <g key={`${d.label}-${i}`}>
                <rect x={i * 18 + 2} y={100 - h} width={14} height={h} fill="var(--accent, #ff5d5d)" rx={2} />
                <title>{`${d.label}: ${d.value}`}</title>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

export default async function AnalyticsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  // Owner-gated: find user's artist/DJ profiles
  const profiles = await db.profile.findMany({
    where: { ownerId: session.user.id, type: { in: ['ARTIST', 'DJ'] } },
    select: { id: true, name: true, slug: true, type: true }
  });
  if (profiles.length === 0 && !isAdminSession(session)) {
    return (
      <main className="container section">
        <h1>Analytics</h1>
        <p className="meta">You need an Artist or DJ profile to view analytics.</p>
        <Link className="button" href="/home">Back</Link>
      </main>
    );
  }

  const profileIds = profiles.map((p) => p.id);
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [hypeEvents, mediaTop, recentFans] = await Promise.all([
    profileIds.length
      ? db.profileHypeEvent.findMany({
          where: { profileId: { in: profileIds }, createdAt: { gte: since } },
          select: { createdAt: true }
        })
      : Promise.resolve([] as { createdAt: Date }[]),
    profileIds.length
      ? db.artistMediaAsset.findMany({
          where: { profileId: { in: profileIds } },
          orderBy: { createdAt: 'desc' },
          take: 50,
          select: { id: true, title: true }
        })
      : Promise.resolve([] as { id: string; title: string }[]),
    profileIds.length
      ? db.profileHypeEvent.findMany({
          where: { profileId: { in: profileIds } },
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: { user: { select: { name: true, username: true } } }
        })
      : Promise.resolve([] as Array<{ id: string; createdAt: Date; user: { name: string | null; username: string } | null }>)
  ]);

  // Bucket hype events by day
  const dayBuckets = new Map<string, number>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    dayBuckets.set(d.toISOString().slice(0, 10), 0);
  }
  for (const evt of hypeEvents) {
    const day = evt.createdAt.toISOString().slice(0, 10);
    if (dayBuckets.has(day)) dayBuckets.set(day, (dayBuckets.get(day) ?? 0) + 1);
  }
  const hypeByDay = [...dayBuckets.entries()].map(([label, value]) => ({ label, value }));

  // Top media (approximation — count occurrences in radioTracks + listens for the asset)
  const mediaIds = mediaTop.map((m) => m.id);
  const listenCounts = mediaIds.length
    ? await db.mediaListen.groupBy({
        by: ['mediaId'],
        where: { mediaId: { in: mediaIds } },
        _count: { mediaId: true }
      }).catch(() => [] as Array<{ mediaId: string; _count: { mediaId: number } }>)
    : [];
  const countMap = new Map(listenCounts.map((r) => [r.mediaId, r._count.mediaId]));
  const topMedia = mediaTop
    .map((m) => ({ label: m.title.slice(0, 16), value: countMap.get(m.id) ?? 0 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  return (
    <main className="container section">
      <h1>Analytics</h1>
      <p className="meta">Last 30 days across your {profiles.length} profile{profiles.length === 1 ? '' : 's'}.</p>
      <div className="grid grid-2" style={{ gap: 12 }}>
        <BarChart data={hypeByDay} label="HYPE per day (30d)" />
        <BarChart data={topMedia} label="Top media (by listens)" />
      </div>
      <section className="panel" style={{ padding: '1rem', marginTop: 12 }}>
        <h3 style={{ marginTop: 0 }}>Profile views</h3>
        <p className="meta">Coming soon — we don't yet record anonymous profile view events.</p>
      </section>
      <section className="panel" style={{ padding: '1rem', marginTop: 12 }}>
        <h3 style={{ marginTop: 0 }}>Recent fans</h3>
        {recentFans.length === 0 ? (
          <div className="empty">No fans yet.</div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
            {recentFans.map((f) => (
              <li key={f.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong>{f.user?.name ?? f.user?.username ?? 'Anonymous'}</strong>
                <span className="meta">{f.createdAt.toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

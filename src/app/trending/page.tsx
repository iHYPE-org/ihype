import Link from 'next/link';
import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { getDemoOwnerExclusion } from '@/lib/runtime-flags';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Trending this week | iHYPE',
  description: 'Profiles ranked by hype velocity over the last 7 days.'
};

type RankedRow = {
  rank: number;
  count: number;
  profile: {
    id: string;
    slug: string;
    name: string;
    type: string;
    city: string | null;
    stateRegion: string | null;
  };
};

function pathForProfile(type: string, slug: string): string {
  switch (type) {
    case 'ARTIST':
      return `/artists/${slug}`;
    case 'VENUE':
      return `/venues/${slug}`;
    case 'DJ':
      return `/djs/${slug}`;
    default:
      return `/profiles/${slug}`;
  }
}

export default async function TrendingPage() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const grouped = await db.profileHypeEvent.groupBy({
    by: ['profileId'],
    where: { createdAt: { gte: sevenDaysAgo } },
    _count: { profileId: true },
    orderBy: { _count: { profileId: 'desc' } },
    take: 20
  });

  const profileIds = grouped.map((g) => g.profileId);
  const profiles = profileIds.length
    ? await db.profile.findMany({
        where: {
          id: { in: profileIds },
          ...getDemoOwnerExclusion()
        },
        select: {
          id: true,
          slug: true,
          name: true,
          type: true,
          city: true,
          stateRegion: true
        }
      })
    : [];
  const profileMap = new Map(profiles.map((p) => [p.id, p]));

  const rows: RankedRow[] = [];
  grouped.forEach((g, i) => {
    const profile = profileMap.get(g.profileId);
    if (!profile) return;
    rows.push({
      rank: i + 1,
      count: g._count.profileId,
      profile: { ...profile, type: profile.type as unknown as string }
    });
  });

  return (
    <main className="container section">
      <header style={{ marginBottom: '1.5rem' }}>
        <div className="badge">TRENDING · LAST 7 DAYS</div>
        <h1 className="title">Trending this week</h1>
        <p className="subtitle">Profiles ranked by hype velocity over the last 7 days.</p>
      </header>

      {rows.length === 0 ? (
        <div className="empty">
          <span className="empty-title">No trending profiles yet.</span>
          <p>Hype an artist, venue, or DJ to see them surface here.</p>
        </div>
      ) : (
        <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 }}>
          {rows.map((row) => {
            const location = [row.profile.city, row.profile.stateRegion].filter(Boolean).join(', ');
            return (
              <li
                key={row.profile.id}
                className="panel"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: '14px 18px'
                }}
              >
                <div
                  style={{
                    fontFamily: 'var(--f-d)',
                    fontWeight: 800,
                    fontSize: 22,
                    color: 'var(--accent)',
                    minWidth: 36,
                    textAlign: 'right'
                  }}
                >
                  {row.rank}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Link
                    href={pathForProfile(row.profile.type, row.profile.slug)}
                    style={{
                      fontFamily: 'var(--f-d)',
                      fontWeight: 700,
                      fontSize: 16,
                      color: 'var(--ink)'
                    }}
                  >
                    {row.profile.name}
                  </Link>
                  <div className="meta">
                    {row.profile.type}
                    {location ? ` · ${location}` : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="meta" style={{ fontSize: 10, letterSpacing: '.14em' }}>
                    HYPE 7D
                  </div>
                  <div style={{ fontFamily: 'var(--f-d)', fontWeight: 700, fontSize: 18 }}>
                    {row.count}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </main>
  );
}

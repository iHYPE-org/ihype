import type { Metadata } from 'next';
import Link from 'next/link';
import { db } from '@/lib/db';

export const metadata: Metadata = {
  title: 'Fan Leaderboard · iHYPE',
  description: 'Top fans by hype count on iHYPE.',
};

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ city?: string }>;
}) {
  const resolved = searchParams ? await searchParams : {};
  const city = resolved.city?.trim() || undefined;

  const profiles = await db.profile.findMany({
    where: {
      type: 'LISTENER',
      ...(city ? { city: { contains: city, mode: 'insensitive' } } : {}),
    },
    select: {
      id: true,
      slug: true,
      name: true,
      city: true,
      stateRegion: true,
      hypeCount: true,
      avatarImage: true,
    },
    orderBy: { hypeCount: 'desc' },
    take: 20,
  });

  return (
    <main className="container section">
      <h1 className="title">Fan Leaderboard</h1>
      <p className="subtitle">Top fans by hype activity.</p>

      <form method="GET" style={{ marginBottom: 24, display: 'flex', gap: 8 }}>
        <input
          className="input"
          defaultValue={city}
          name="city"
          placeholder="Filter by city…"
          style={{ maxWidth: 240 }}
          type="text"
        />
        <button className="button secondary" type="submit">
          Filter
        </button>
        {city && (
          <Link className="button secondary" href="/leaderboard">
            Clear
          </Link>
        )}
      </form>

      {profiles.length === 0 ? (
        <p className="meta">No fans found{city ? ` in "${city}"` : ''}.</p>
      ) : (
        <ol style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {profiles.map((profile, index) => (
            <li
              key={profile.id}
              className="panel"
              style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 16px' }}
            >
              <span
                style={{
                  fontWeight: 700,
                  fontSize: 18,
                  minWidth: 32,
                  textAlign: 'right',
                  opacity: 0.5,
                }}
              >
                {index + 1}
              </span>
              {profile.avatarImage && (
                <img
                  alt={profile.name}
                  src={profile.avatarImage}
                  style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }}
                />
              )}
              <div style={{ flex: 1 }}>
                <Link href={`/fans/${profile.slug}`} style={{ fontWeight: 600 }}>
                  {profile.name}
                </Link>
                {(profile.city || profile.stateRegion) && (
                  <p className="meta" style={{ margin: 0 }}>
                    {[profile.city, profile.stateRegion].filter(Boolean).join(', ')}
                  </p>
                )}
              </div>
              <span style={{ fontWeight: 700, color: 'var(--accent)' }}>
                {profile.hypeCount.toLocaleString()} hype
              </span>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}

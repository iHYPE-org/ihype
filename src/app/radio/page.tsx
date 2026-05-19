import { db } from '@/lib/db';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function RadioPage() {
  // Get genres that have radio shows
  const shows = await db.show.findMany({
    where: { isRadioShow: true, status: 'SCHEDULED' },
    select: { id: true, slug: true, title: true, tags: true, hypeCount: true, headlinerProfile: { select: { name: true, slug: true } } },
    orderBy: { hypeCount: 'desc' },
    take: 50
  });

  // Group by first tag/genre
  const byGenre = new Map<string, typeof shows>();
  for (const show of shows) {
    const genre = (show.tags[0] ?? 'Other');
    if (!byGenre.has(genre)) byGenre.set(genre, []);
    byGenre.get(genre)!.push(show);
  }

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 60 }}>
      <h1>Genre Radio</h1>
      <p className="meta">Curated radio shows by genre — live and on-demand.</p>
      {byGenre.size === 0 && <p className="meta">No radio shows available yet.</p>}
      {Array.from(byGenre.entries()).map(([genre, genreShows]) => (
        <section key={genre} style={{ marginBottom: 32 }}>
          <h2 style={{ marginBottom: 12 }}>{genre}</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {genreShows.slice(0, 5).map(s => (
              <Link key={s.id} href={`/shows/${s.slug}`} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--line)', textDecoration: 'none' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{s.title}</div>
                  {s.headlinerProfile && <div className="meta">{s.headlinerProfile.name}</div>}
                </div>
                <div className="meta">{s.hypeCount} hypes</div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

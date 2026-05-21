import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function RadioPage() {
  const [session, shows] = await Promise.all([
    auth(),
    db.show.findMany({
      where: { isRadioShow: true, status: { in: ['SCHEDULED', 'LIVE'] } },
      select: { id: true, slug: true, title: true, tags: true, hypeCount: true, headlinerProfile: { select: { name: true, slug: true } } },
      orderBy: { hypeCount: 'desc' },
      take: 50
    })
  ]);

  const role = (session?.user as { role?: string } | undefined)?.role ?? '';
  const canCreate = role === 'DJ' || role === 'PROMOTER' || role === 'ADMIN';

  // Group by first tag/genre
  const byGenre = new Map<string, typeof shows>();
  for (const show of shows) {
    const genre = show.tags[0] ?? 'Other';
    if (!byGenre.has(genre)) byGenre.set(genre, []);
    byGenre.get(genre)!.push(show);
  }

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 80, position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
        <h1>Genre Radio</h1>
        {canCreate && (
          <Link
            href="/radio/studio"
            style={{
              display: 'none', // shown via CSS at desktop widths only — FAB handles mobile
              fontFamily: 'var(--f-m)', fontSize: 11, letterSpacing: '.1em',
              color: '#ff3e9a', textDecoration: 'none', padding: '6px 14px',
              border: '1px solid rgba(255,62,154,.4)', borderRadius: 99,
            }}
            className="radio-create-link"
          >
            + NEW SHOW
          </Link>
        )}
      </div>
      <p className="meta">Curated radio shows by genre — live and on-demand.</p>

      {byGenre.size === 0 && <p className="meta" style={{ marginTop: 24 }}>No radio shows yet. {canCreate ? 'Be the first.' : ''}</p>}

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

      {/* Mobile FAB — DJ/promoter only */}
      {canCreate && (
        <Link
          href="/radio/studio"
          aria-label="Open Radio Studio"
          style={{
            position: 'fixed', right: 18, bottom: 88,
            height: 56, padding: '0 22px', borderRadius: 18,
            background: '#ff3e9a', color: '#0a0805', textDecoration: 'none',
            fontFamily: 'var(--f-m)', fontWeight: 600, fontSize: 14,
            display: 'flex', alignItems: 'center', gap: 8,
            boxShadow: '0 6px 24px rgba(255,62,154,.45)',
            zIndex: 50,
          }}
          className="radio-studio-fab"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          New show
        </Link>
      )}
    </div>
  );
}

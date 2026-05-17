import Link from 'next/link';
import { db } from '@/lib/db';

export async function NewToScene() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const profiles = await db.profile.findMany({
    where: {
      createdAt: { gte: thirtyDaysAgo },
      type: { in: ['ARTIST', 'DJ'] },
      hostedShows: { none: {} },
      headlinerShows: { none: {} }
    },
    select: { id: true, slug: true, name: true, type: true, city: true, stateRegion: true },
    orderBy: { createdAt: 'desc' },
    take: 6
  });

  if (profiles.length === 0) return null;

  return (
    <section style={{ marginTop: 32 }}>
      <header style={{ marginBottom: 12 }}>
        <div className="badge">NEW TO THE SCENE</div>
        <h2 className="title" style={{ fontSize: '1.4rem', margin: '4px 0 0' }}>
          Fresh faces
        </h2>
      </header>
      <div className="grid grid-3" style={{ gap: 12 }}>
        {profiles.map((p) => {
          const location = [p.city, p.stateRegion].filter(Boolean).join(', ');
          const href = p.type === 'DJ' ? `/djs/${p.slug}` : `/artists/${p.slug}`;
          return (
            <Link
              key={p.id}
              href={href}
              className="panel"
              style={{ padding: '14px 16px', textDecoration: 'none', color: 'var(--ink)' }}
            >
              <div style={{ fontWeight: 700, fontSize: 15 }}>{p.name}</div>
              <div className="meta" style={{ fontSize: 11, marginTop: 2 }}>
                {p.type}
                {location ? ` · ${location}` : ''}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

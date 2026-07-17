import Link from 'next/link';
import { db } from '@/lib/db';

export const metadata = { title: 'Journal · iHYPE' };
export const dynamic = 'force-dynamic';

type EditorialMeta = {
  slug?: string;
  title?: string;
  excerpt?: string;
  body?: string;
  author?: string;
  publishedAt?: string;
};

export default async function JournalIndex() {
  const rows = await db.auditLog.findMany({
    where: { action: 'editorial_post' },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { id: true, createdAt: true, metadata: true }
  });

  const posts = rows
    .map((r) => ({ id: r.id, createdAt: r.createdAt, meta: (r.metadata ?? {}) as EditorialMeta }))
    .filter((p) => typeof p.meta.slug === 'string' && typeof p.meta.title === 'string');

  return (
    <div className="container section" style={{ maxWidth: 680 }}>
      <h1
        style={{
          fontFamily: 'var(--f-d)',
          fontWeight: 800,
          fontSize: 'clamp(2rem, 6vw, 3rem)',
          letterSpacing: '-.04em'
        }}
      >
        Journal
      </h1>
      <p
        className="meta"
        style={{ fontFamily: 'var(--f-m)', fontSize: '.72rem', letterSpacing: '.1em', margin: '10px 0 36px' }}
      >
        Editorial coverage of the local scene from the iHYPE team.
      </p>
      {posts.length === 0 ? (
        <p className="meta">No journal posts yet.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 12 }}>
          {posts.map((p) => (
            <li key={p.id} className="panel" style={{ padding: '22px 26px', borderRadius: 14 }}>
              <Link href={`/journal/${p.meta.slug}`} className="text-link">
                <h2
                  style={{
                    marginTop: 0,
                    fontFamily: 'var(--f-d)',
                    fontWeight: 800,
                    fontSize: '1.2rem',
                    letterSpacing: '-.02em',
                    color: 'var(--accent)'
                  }}
                >
                  {p.meta.title}
                </h2>
              </Link>
              {p.meta.excerpt ? (
                <p style={{ fontSize: '.9rem', color: 'var(--ink-2)', lineHeight: 1.6, margin: '8px 0 10px' }}>
                  {p.meta.excerpt}
                </p>
              ) : null}
              <p className="meta" style={{ fontFamily: 'var(--f-m)', fontSize: '.66rem' }}>
                {p.meta.author ?? 'iHYPE'} · {p.createdAt.toLocaleDateString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

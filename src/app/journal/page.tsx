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
    <main className="container section">
      <h1>Journal</h1>
      <p className="meta">Editorial coverage of the local scene from the iHYPE team.</p>
      {posts.length === 0 ? (
        <p className="meta">No journal posts yet.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 12 }}>
          {posts.map((p) => (
            <li key={p.id} className="panel" style={{ padding: '1rem 1.25rem' }}>
              <Link href={`/journal/${p.meta.slug}`} className="text-link">
                <h2 style={{ marginTop: 0 }}>{p.meta.title}</h2>
              </Link>
              {p.meta.excerpt ? <p>{p.meta.excerpt}</p> : null}
              <p className="meta">
                {p.meta.author ?? 'iHYPE'} · {p.createdAt.toLocaleDateString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

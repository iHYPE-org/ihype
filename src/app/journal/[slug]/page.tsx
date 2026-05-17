import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

type EditorialMeta = {
  slug?: string;
  title?: string;
  excerpt?: string;
  body?: string;
  author?: string;
  publishedAt?: string;
};

export default async function JournalPost({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const rows = await db.auditLog.findMany({
    where: { action: 'editorial_post' },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: { id: true, createdAt: true, metadata: true }
  });
  const found = rows.find((r) => {
    const meta = (r.metadata ?? {}) as EditorialMeta;
    return meta.slug === slug;
  });
  if (!found) return notFound();
  const meta = (found.metadata ?? {}) as EditorialMeta;

  return (
    <main className="container section" style={{ maxWidth: 720 }}>
      <Link href="/journal" className="text-link meta">← Journal</Link>
      <h1>{meta.title}</h1>
      <p className="meta">
        {meta.author ?? 'iHYPE'} · {found.createdAt.toLocaleDateString()}
      </p>
      {meta.body ? (
        <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{meta.body}</div>
      ) : (
        <p className="meta">This post has no body.</p>
      )}
    </main>
  );
}

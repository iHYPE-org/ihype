import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

type EditorialMeta = {
  slug?: string;
  title?: string;
  excerpt?: string;
  body?: string;
  author?: string;
  publishedAt?: string;
};

async function findEditorialPost(slug: string) {
  const rows = await db.auditLog.findMany({
    where: { action: 'editorial_post' },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: { id: true, createdAt: true, metadata: true }
  });
  return rows.find((r) => ((r.metadata ?? {}) as EditorialMeta).slug === slug);
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const found = await findEditorialPost(slug);
  if (!found) return { title: 'Journal · iHYPE' };

  const meta        = (found.metadata ?? {}) as EditorialMeta;
  const title       = `${meta.title ?? 'Journal'} · iHYPE`;
  const description = meta.excerpt ?? meta.body?.slice(0, 160) ?? 'iHYPE journal';
  const ogImage      = `/api/og?${new URLSearchParams({ title: meta.title ?? 'Journal', subtitle: meta.author ?? 'iHYPE', type: 'journal' }).toString()}`;

  return {
    title,
    description,
    openGraph: {
      type: 'article',
      siteName: 'iHYPE',
      title,
      description,
      url: `/journal/${slug}`,
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export default async function JournalPost({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const found = await findEditorialPost(slug);
  if (!found) return notFound();
  const meta = (found.metadata ?? {}) as EditorialMeta;

  return (
    <div className="container section" style={{ maxWidth: 720 }}>
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
    </div>
  );
}

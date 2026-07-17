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
  const paragraphs = meta.body ? meta.body.split(/\n{2,}/).filter(Boolean) : [];

  return (
    <div className="container section" style={{ maxWidth: 680 }}>
      <Link
        href="/journal"
        className="text-link meta"
        style={{
          display: 'inline-block',
          fontFamily: 'var(--f-m)',
          fontSize: '.7rem',
          letterSpacing: '.1em',
          textTransform: 'uppercase',
          marginBottom: 26
        }}
      >
        ← Journal
      </Link>
      <h1
        style={{
          fontFamily: 'var(--f-d)',
          fontWeight: 800,
          fontSize: 'clamp(1.8rem, 5vw, 2.6rem)',
          letterSpacing: '-.03em',
          lineHeight: 1.08
        }}
      >
        {meta.title}
      </h1>
      <p className="meta" style={{ fontFamily: 'var(--f-m)', fontSize: '.68rem', margin: '14px 0 30px' }}>
        {meta.author ?? 'iHYPE'} · {found.createdAt.toLocaleDateString()}
      </p>
      {meta.excerpt ? (
        <div
          style={{
            fontFamily: 'var(--f-s)',
            fontSize: '1.28rem',
            fontStyle: 'italic',
            color: 'var(--ink)',
            lineHeight: 1.55,
            borderLeft: '3px solid var(--accent)',
            paddingLeft: 20,
            marginBottom: 26
          }}
        >
          {meta.excerpt}
        </div>
      ) : null}
      {paragraphs.length > 0 ? (
        paragraphs.map((para, i) => (
          <p key={i} style={{ fontSize: '1rem', color: 'var(--ink-2)', lineHeight: 1.85, marginBottom: 20 }}>
            {para}
          </p>
        ))
      ) : (
        <p className="meta">This post has no body.</p>
      )}
      <div
        style={{
          marginTop: 40,
          padding: '20px 24px',
          background: 'rgba(255,80,41,.06)',
          border: '1px solid rgba(255,80,41,.2)',
          borderRadius: 14,
          fontSize: '.88rem',
          color: 'var(--ink-2)',
          lineHeight: 1.6
        }}
      >
        Every show covered in the Journal splits 70/20/10 — and iHYPE takes 0%.{' '}
        <Link href="/charter" style={{ color: 'var(--accent)' }}>
          See the charter →
        </Link>
      </div>
    </div>
  );
}

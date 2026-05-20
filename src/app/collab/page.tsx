import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { db } from '@/lib/db';

export const metadata: Metadata = { title: 'Collaboration Board · iHYPE' };
export const dynamic = 'force-dynamic';

const TYPES = ['seeking_drummer','seeking_bassist','seeking_vocalist','seeking_guitarist','seeking_producer','seeking_support_act','seeking_promoter','open_to_collab'];

export default async function CollabPage({ searchParams }: { searchParams?: Promise<{ type?: string }> }) {
  const sp = searchParams ? await searchParams : {};
  const type = sp.type ?? undefined;
  const posts = await db.collabPost.findMany({
    where: { active: true, ...(type ? { type } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { profile: { select: { name: true, slug: true, type: true, avatarImage: true } } }
  });
  return (
    <main className="container section">
      <h1 className="title">Collaboration Board</h1>
      <p className="subtitle">Artists looking for collaborators, support acts, and more.</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
        <Link className={`button small ${!type ? '' : 'secondary'}`} href="/collab">All</Link>
        {TYPES.map(t => <Link key={t} className={`button small ${type === t ? '' : 'secondary'}`} href={`/collab?type=${t}`}>{t.replace(/_/g,' ')}</Link>)}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {posts.length === 0 && <p className="empty">No posts yet.</p>}
        {posts.map(post => (
          <div className="panel" key={post.id}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
              {post.profile.avatarImage && <Image alt={post.profile.name} src={post.profile.avatarImage} width={36} height={36} style={{ borderRadius: '50%', objectFit: 'cover' }} />}
              <div>
                <Link href={`/artists/${post.profile.slug}`}><strong>{post.profile.name}</strong></Link>
                <span className="badge" style={{ marginLeft: 8 }}>{post.type.replace(/_/g, ' ')}</span>
              </div>
            </div>
            <p>{post.description}</p>
            <p className="meta">{new Date(post.createdAt).toLocaleDateString()}</p>
          </div>
        ))}
      </div>
    </main>
  );
}

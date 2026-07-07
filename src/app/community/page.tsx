import Link from 'next/link';
import { db } from '@/lib/db';

export const metadata = { title: 'Community · iHYPE', description: 'Platform updates, announcements, and a vote on what we build next.' };
export const dynamic = 'force-dynamic';

type CommunityMeta = {
  slug?: string;
  title?: string;
  summary?: string;
  body?: string;
  category?: 'update' | 'announcement';
  author?: string;
};

const CATEGORY_LABEL: Record<string, string> = { update: 'Update', announcement: 'Announcement' };

export default async function CommunityPage() {
  const rows = await db.auditLog.findMany({
    where: { action: 'community_update' },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { id: true, createdAt: true, metadata: true }
  });

  const posts = rows
    .map((r) => ({ id: r.id, createdAt: r.createdAt, meta: (r.metadata ?? {}) as CommunityMeta }))
    .filter((p) => typeof p.meta.slug === 'string' && typeof p.meta.title === 'string');

  return (
    <div className="container section">
      <h1>Community</h1>
      <p className="meta">Communications and changes from the iHYPE team, plus a real vote on what we build next.</p>

      <div className="panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 24 }}>
        <div>
          <strong>Vote on what's next</strong>
          <p className="meta" style={{ margin: '4px 0 0' }}>Every feature request here is a real, counted vote — the charter promise "you get a vote" points at this.</p>
        </div>
        <Link className="button" href="/feedback" style={{ flexShrink: 0 }}>Vote &amp; suggest →</Link>
      </div>

      {posts.length === 0 ? (
        <p className="meta">No community updates yet.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 12 }}>
          {posts.map((p) => (
            <li key={p.id} className="panel" style={{ padding: '1rem 1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span className="badge">{CATEGORY_LABEL[p.meta.category ?? 'update'] ?? 'Update'}</span>
                <span className="meta">{p.createdAt.toLocaleDateString()}</span>
              </div>
              <h2 style={{ margin: '0 0 4px' }}>{p.meta.title}</h2>
              {p.meta.summary ? <p className="meta" style={{ margin: '0 0 8px' }}>{p.meta.summary}</p> : null}
              {p.meta.body ? <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{p.meta.body}</p> : null}
              <p className="meta" style={{ margin: '8px 0 0' }}>{p.meta.author ?? 'iHYPE'}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

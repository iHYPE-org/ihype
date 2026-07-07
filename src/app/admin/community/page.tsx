import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AdminCommunityEditor } from '@/components/AdminCommunityEditor';
import { auth } from '@/lib/auth';
import { WORKBENCH_PATH } from '@/lib/auth-redirects';
import { db } from '@/lib/db';
import { isAdminSession } from '@/lib/permissions';

export const metadata: Metadata = {
  title: 'Community · iHYPE Admin',
  robots: { index: false, follow: false }
};
export const dynamic = 'force-dynamic';

export default async function AdminCommunityPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  if (!isAdminSession(session)) redirect(WORKBENCH_PATH);

  const posts = await db.auditLog.findMany({
    where: { action: 'community_update' },
    orderBy: { createdAt: 'desc' },
    take: 50
  });

  return (
    <div className="container section admin-console">
      <section className="panel">
        <h1>Community editor</h1>
        <p className="meta">
          Publishes to /community — same AuditLog-backed pattern as the Journal editor, no new tables.
          Feature-request voting stays on /feedback; this is the "communications and changes" half.
        </p>
        <AdminCommunityEditor />
      </section>

      <section className="panel" style={{ marginTop: 12 }}>
        <h2>Recent posts</h2>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
          {posts.map((p) => {
            const meta = (p.metadata ?? {}) as { slug?: string; title?: string; category?: string };
            return (
              <li key={p.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <span>
                  <span className="badge" style={{ marginRight: 8 }}>{meta.category ?? 'update'}</span>
                  <strong>{meta.title ?? meta.slug ?? p.entityId}</strong>
                </span>
                <span className="meta">{p.createdAt.toLocaleString()}</span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

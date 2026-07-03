import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AdminJournalEditor } from '@/components/AdminJournalEditor';
import { auth } from '@/lib/auth';
import { WORKBENCH_PATH } from '@/lib/auth-redirects';
import { db } from '@/lib/db';
import { isAdminSession } from '@/lib/permissions';
import { recordAuditEvent } from '@/lib/audit';

export const metadata: Metadata = {
  title: 'Journal · iHYPE Admin',
  robots: { index: false, follow: false }
};
export const dynamic = 'force-dynamic';

async function seedSamplePost() {
  'use server';
  const session = await auth();
  if (!session?.user?.id || !isAdminSession(session)) return;
  await recordAuditEvent({
    actorUserId: session.user.id,
    action: 'editorial_post',
    entityType: 'journal',
    entityId: 'welcome-to-the-journal',
    metadata: {
      slug: 'welcome-to-the-journal',
      title: 'Welcome to the iHYPE Journal',
      excerpt: 'Our editorial coverage of the local music scene starts here.',
      body:
        'The iHYPE Journal is where we feature artists, venues, and shows that move the local scene forward. ' +
        'Look for interviews, scene reports, and show recaps.\n\nStay tuned.',
      author: session.user.name ?? 'iHYPE',
      publishedAt: new Date().toISOString()
    }
  });
}

export default async function AdminJournalPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  if (!isAdminSession(session)) redirect(WORKBENCH_PATH);

  const posts = await db.auditLog.findMany({
    where: { action: 'editorial_post' },
    orderBy: { createdAt: 'desc' },
    take: 50
  });

  return (
    <main className="container section admin-console">
      <section className="panel">
        <h1>Journal editor</h1>
        <p className="meta">Editorial posts are written to AuditLog so we don't need new tables.</p>
        <AdminJournalEditor />
      </section>

      <section className="panel" style={{ marginTop: 12 }}>
        <h2>Recent posts</h2>
        <form action={seedSamplePost} style={{ marginBottom: 8 }}>
          <button className="button small secondary" type="submit">Seed sample post</button>
        </form>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
          {posts.map((p) => {
            const meta = (p.metadata ?? {}) as { slug?: string; title?: string };
            return (
              <li key={p.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong>{meta.title ?? meta.slug ?? p.entityId}</strong>
                <span className="meta">{p.createdAt.toLocaleString()}</span>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}

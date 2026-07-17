import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { WORKBENCH_PATH } from '@/lib/auth-redirects';
import { db } from '@/lib/db';
import { isAdminSession } from '@/lib/permissions';
import { AdminAbTestsClient } from '@/components/AdminAbTestsClient';

export const metadata: Metadata = {
  title: 'A/B tests | iHYPE Admin',
  robots: { index: false, follow: false }
};

export const dynamic = 'force-dynamic';

export default async function AdminAbTestsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  if (!isAdminSession(session)) redirect(WORKBENCH_PATH);

  const tests = await db.aBTest.findMany({ orderBy: { createdAt: 'desc' } });

  return (
    <div className="container section admin-console">
      <section className="panel admin-console-panel">
        <h1 style={{ fontSize: 20, marginBottom: 16 }}>A/B tests <span className="meta">({tests.length})</span></h1>
        <AdminAbTestsClient initialTests={tests} />
      </section>
    </div>
  );
}

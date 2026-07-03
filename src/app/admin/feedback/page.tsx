import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isAdminSession } from '@/lib/permissions';
import { FeedbackStatusSelect } from '@/components/admin/FeedbackStatusSelect';

export const dynamic = 'force-dynamic';

export default async function AdminFeedbackPage() {
  const session = await auth();
  if (!isAdminSession(session)) redirect('/');
  const requests = await db.featureRequest.findMany({ orderBy: [{ votes: 'desc' }, { createdAt: 'desc' }] });
  return (
    <main className="container section">
      <h1 className="title">Feature Requests</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {requests.map(fr => (
          <div className="panel" key={fr.id} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <strong style={{ minWidth: 40 }}>▲ {fr.votes}</strong>
            <div style={{ flex: 1 }}>
              <strong>{fr.title}</strong>
              <p className="meta" style={{ margin: '4px 0 0' }}>{fr.description}</p>
              <p className="meta">{new Date(fr.createdAt).toLocaleString()}</p>
            </div>
            <FeedbackStatusSelect id={fr.id} status={fr.status} />
          </div>
        ))}
      </div>
    </main>
  );
}

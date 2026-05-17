import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isAdminSession } from '@/lib/permissions';

export const metadata: Metadata = {
  title: 'Flagged Content | Admin | iHYPE',
  robots: { index: false, follow: false }
};

export const dynamic = 'force-dynamic';

export default async function AdminFlaggedPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  if (!isAdminSession(session)) redirect('/home');

  const reports = await db.report.findMany({
    where: { status: 'open' },
    orderBy: { createdAt: 'desc' },
    take: 200
  });

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px' }}>
      <h1 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 28, marginBottom: 8 }}>
        Flagged Content
      </h1>
      <p style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 32 }}>
        {reports.length} open report{reports.length !== 1 ? 's' : ''}
      </p>

      {reports.length === 0 ? (
        <p style={{ fontSize: 14, color: 'var(--ink-3)' }}>No open reports.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'var(--f-m)' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--line-2)', color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '.08em' }}>
              <th style={{ padding: '8px 12px', textAlign: 'left' }}>Date</th>
              <th style={{ padding: '8px 12px', textAlign: 'left' }}>Type</th>
              <th style={{ padding: '8px 12px', textAlign: 'left' }}>Entity ID</th>
              <th style={{ padding: '8px 12px', textAlign: 'left' }}>Reason</th>
              <th style={{ padding: '8px 12px', textAlign: 'left' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id} style={{ borderBottom: '1px solid var(--line)' }}>
                <td style={{ padding: '10px 12px' }}>{new Date(r.createdAt).toLocaleDateString()}</td>
                <td style={{ padding: '10px 12px' }}>{r.entityType}</td>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 11, color: 'var(--ink-3)' }}>{r.entityId}</td>
                <td style={{ padding: '10px 12px' }}>{r.reason.slice(0, 120)}{r.reason.length > 120 ? '…' : ''}</td>
                <td style={{ padding: '10px 12px' }}>
                  <CloseButton reportId={r.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

async function closeReport(reportId: string) {
  'use server';
  const session = await auth();
  if (!isAdminSession(session)) throw new Error('Forbidden');
  await db.report.update({ where: { id: reportId }, data: { status: 'closed' } });
}

function CloseButton({ reportId }: { reportId: string }) {
  return (
    <form action={closeReport.bind(null, reportId)}>
      <button
        type="submit"
        style={{
          background: 'rgba(34,229,212,.12)',
          color: '#22e5d4',
          border: '1px solid rgba(34,229,212,.2)',
          borderRadius: 6,
          padding: '4px 12px',
          fontSize: 11,
          cursor: 'pointer'
        }}
      >
        Close
      </button>
    </form>
  );
}

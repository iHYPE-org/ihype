import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isAdminSession } from '@/lib/permissions';

export const metadata: Metadata = {
  title: 'Content Reports | Admin | iHYPE.org',
  robots: { index: false, follow: false },
};

export default async function AdminReportsPage() {
  const session = await auth();

  if (!session?.user?.id) redirect('/login');
  if (!isAdminSession(session)) redirect('/auth/landing');

  const reports = await db.contentReport.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      reporter: { select: { id: true, name: true, email: true } },
    },
    take: 200,
  });

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px' }}>
      <h1 style={{ fontFamily: 'var(--f-d)', fontWeight: 800, fontSize: 28, letterSpacing: '-.02em', color: 'var(--ink)', marginBottom: 8 }}>
        Content Reports
      </h1>
      <p style={{ fontFamily: 'var(--f-m)', fontSize: 13, color: 'var(--ink-2)', marginBottom: 32 }}>
        {reports.length} report{reports.length !== 1 ? 's' : ''} total
      </p>

      {reports.length === 0 ? (
        <p style={{ fontFamily: 'var(--f-m)', fontSize: 14, color: 'var(--ink-3)' }}>No reports yet.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--f-m)', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--line-2)', color: 'var(--ink-3)', letterSpacing: '.08em', textTransform: 'uppercase' }}>
                <th style={thStyle}>Date</th>
                <th style={thStyle}>Reason</th>
                <th style={thStyle}>Target type</th>
                <th style={thStyle}>Target ID</th>
                <th style={thStyle}>Reporter</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Action</th>
              </tr>
            </thead>
            <tbody>
              {reports.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--line)' }}>
                  <td style={tdStyle}>{new Date(r.createdAt).toLocaleDateString()}</td>
                  <td style={tdStyle}>{r.reason}</td>
                  <td style={tdStyle}>{r.targetType}</td>
                  <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 11, color: 'var(--ink-3)' }}>{r.targetId}</td>
                  <td style={tdStyle}>
                    {r.reporter ? (
                      <span title={r.reporter.email ?? ''}>{r.reporter.name ?? r.reporter.email}</span>
                    ) : (
                      <span style={{ color: 'var(--ink-3)' }}>Anonymous</span>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: 10,
                      letterSpacing: '.08em',
                      background: r.status === 'OPEN' ? 'rgba(255,80,41,.15)' : 'rgba(34,229,212,.1)',
                      color: r.status === 'OPEN' ? 'var(--accent)' : '#22e5d4',
                    }}>
                      {r.status}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    {r.status === 'OPEN' && (
                      <ResolveButton reportId={r.id} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 12px',
  fontWeight: 600,
  fontSize: 10,
};

const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
  color: 'var(--ink)',
  verticalAlign: 'middle',
};

async function resolveReport(reportId: string) {
  'use server';
  const session = await auth();
  if (!isAdminSession(session)) throw new Error('Forbidden');
  await db.contentReport.update({ where: { id: reportId }, data: { status: 'RESOLVED' } });
  // revalidate happens on next navigation
}

function ResolveButton({ reportId }: { reportId: string }) {
  return (
    <form action={resolveReport.bind(null, reportId)}>
      <button
        type="submit"
        style={{
          background: 'rgba(34,229,212,.12)',
          color: '#22e5d4',
          border: '1px solid rgba(34,229,212,.2)',
          borderRadius: 6,
          padding: '4px 12px',
          fontSize: 11,
          cursor: 'pointer',
          fontFamily: 'var(--f-m)',
          letterSpacing: '.04em',
        }}
      >
        Resolve
      </button>
    </form>
  );
}

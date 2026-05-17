import type { Metadata } from 'next';
import { db } from '@/lib/db';

export const metadata: Metadata = {
  title: 'System Status · iHYPE',
  robots: { index: false, follow: false },
};

const REQUIRED_ENV_VARS = ['RESEND_API_KEY', 'AUTH_SECRET', 'DATABASE_URL'] as const;

async function checkDb(): Promise<boolean> {
  try {
    await db.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 10,
        height: 10,
        borderRadius: '50%',
        background: ok ? '#22e5d4' : '#ff3e3e',
        marginRight: 8,
        flexShrink: 0,
      }}
    />
  );
}

export default async function StatusPage() {
  const dbOk = await checkDb();

  const envChecks = REQUIRED_ENV_VARS.map((key) => ({
    key,
    ok: Boolean(process.env[key]),
  }));

  const allOk = dbOk && envChecks.every((c) => c.ok);

  return (
    <main className="container section" style={{ maxWidth: 560 }}>
      <h1 className="title">System Status</h1>
      <p className="meta" style={{ marginBottom: 24 }}>
        {allOk ? '✅ All systems operational' : '⚠️ Some checks failed'}
      </p>

      <div className="panel" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <StatusDot ok={dbOk} />
          <span>Database</span>
          <span className="meta" style={{ marginLeft: 'auto' }}>{dbOk ? 'Connected' : 'Error'}</span>
        </div>

        {envChecks.map(({ key, ok }) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center' }}>
            <StatusDot ok={ok} />
            <span style={{ fontFamily: 'var(--font-jb, monospace)', fontSize: 13 }}>{key}</span>
            <span className="meta" style={{ marginLeft: 'auto' }}>{ok ? 'Present' : 'Missing'}</span>
          </div>
        ))}
      </div>

      <p className="meta" style={{ marginTop: 16 }}>
        Checked at {new Date().toUTCString()}
      </p>
    </main>
  );
}

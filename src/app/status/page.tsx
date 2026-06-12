import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { getHealthSnapshot } from '@/lib/health';
import { kvPut } from '@/lib/kv';
import { getRateLimitMetrics } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

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

async function checkResend(): Promise<{ ok: boolean; label: string }> {
  if (!process.env.RESEND_API_KEY) return { ok: false, label: 'API key missing' };
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'GET',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` }
    });
    // 200 or 405 both mean the key is valid
    return { ok: res.status < 500, label: res.status < 500 ? 'Reachable' : `HTTP ${res.status}` };
  } catch {
    return { ok: false, label: 'Unreachable' };
  }
}

async function checkKv(): Promise<{ ok: boolean; label: string }> {
  try {
    await kvPut('status:ping', Date.now(), { ex: 60 });
    return { ok: true, label: 'Connected' };
  } catch {
    return { ok: false, label: 'Error' };
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
  const [dbOk, resendResult, kvResult, rateLimitMetrics, health] = await Promise.all([
    checkDb(),
    checkResend(),
    checkKv(),
    getRateLimitMetrics(50).catch(() => [] as Array<{ bucket: string; hits: number }>),
    getHealthSnapshot()
  ]);

  const envChecks = REQUIRED_ENV_VARS.map((key) => ({
    key,
    ok: Boolean(process.env[key]),
  }));

  const stripePresent = Boolean(process.env.STRIPE_SECRET_KEY);

  const allOk =
    dbOk &&
    resendResult.ok &&
    stripePresent &&
    envChecks.every((c) => c.ok);
  const launchBlockers = health.status === 'ok' ? health.launchReadiness.blockers : ['Health snapshot is degraded.'];

  return (
    <main className="container section" style={{ maxWidth: 560 }}>
      <h1 className="title">System Status</h1>
      <p className="meta" style={{ marginBottom: 24 }}>
        {allOk ? '✅ All systems operational' : '⚠️ Some checks failed'}
      </p>

      <div className="panel" style={{ padding: '16px 20px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: launchBlockers.length ? 10 : 0 }}>
          <StatusDot ok={launchBlockers.length === 0} />
          <span>Launch readiness</span>
          <span className="meta" style={{ marginLeft: 'auto' }}>
            {launchBlockers.length === 0 ? 'Ready' : `${launchBlockers.length} blockers`}
          </span>
        </div>
        {launchBlockers.length > 0 ? (
          <ul className="meta" style={{ margin: 0, paddingLeft: 18 }}>
            {launchBlockers.map((blocker) => (
              <li key={blocker}>{blocker}</li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="panel" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <StatusDot ok={dbOk} />
          <span>Database</span>
          <span className="meta" style={{ marginLeft: 'auto' }}>{dbOk ? 'Connected' : 'Error'}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center' }}>
          <StatusDot ok={resendResult.ok} />
          <span>Resend (email)</span>
          <span className="meta" style={{ marginLeft: 'auto' }}>{resendResult.label}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center' }}>
          <StatusDot ok={kvResult.ok} />
          <span>KV (Cloudflare KV)</span>
          <span className="meta" style={{ marginLeft: 'auto' }}>{kvResult.label}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center' }}>
          <StatusDot ok={true} />
          <span>AI (Cloudflare Workers AI)</span>
          <span className="meta" style={{ marginLeft: 'auto' }}>Built-in binding</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center' }}>
          <StatusDot ok={stripePresent} />
          <span style={{ fontFamily: 'var(--font-jb, monospace)', fontSize: 13 }}>STRIPE_SECRET_KEY</span>
          <span className="meta" style={{ marginLeft: 'auto' }}>{stripePresent ? 'Present' : 'Missing'}</span>
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

      {rateLimitMetrics.length > 0 && (
        <>
          <h2 className="title" style={{ fontSize: '1.25rem', marginTop: 32 }}>Rate Limit Metrics</h2>
          <p className="meta" style={{ marginBottom: 12 }}>Top {rateLimitMetrics.length} buckets by request count.</p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--f-m)', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--line-2)', color: 'var(--ink-3)', letterSpacing: '.08em', textTransform: 'uppercase' }}>
                  <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, fontSize: 10 }}>Bucket key</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 600, fontSize: 10 }}>Hits</th>
                </tr>
              </thead>
              <tbody>
                {rateLimitMetrics.map((m) => (
                  <tr key={m.bucket} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '10px 12px', color: 'var(--ink)', fontFamily: 'monospace', fontSize: 11 }}>{m.bucket}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: m.hits > 100 ? '#ff3e9a' : 'var(--ink)' }}>{m.hits}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { WORKBENCH_PATH } from '@/lib/auth-redirects';
import { isAdminSession } from '@/lib/permissions';
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
  const color = ok ? 'var(--success)' : '#ff3e3e';
  return (
    <span
      style={{
        display: 'inline-block',
        width: 10,
        height: 10,
        borderRadius: '50%',
        background: color,
        boxShadow: `0 0 10px ${color}`,
        flexShrink: 0,
      }}
    />
  );
}

export default async function StatusPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  if (!isAdminSession(session)) redirect(WORKBENCH_PATH);

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
    <div className="container section" style={{ maxWidth: 760 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 10 }}>
        <h1 className="title" style={{ margin: 0 }}>System status</h1>
        <span className="meta" style={{ fontFamily: 'var(--f-m)', fontSize: '0.64rem', letterSpacing: '.14em', textTransform: 'uppercase' }}>
          Admin only · refreshed on load
        </span>
      </div>

      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 9,
          margin: '16px 0 36px',
          fontFamily: 'var(--f-m)',
          fontSize: '0.72rem',
          letterSpacing: '.14em',
          textTransform: 'uppercase',
          color: allOk ? 'var(--success)' : 'var(--warning)',
          border: `1px solid ${allOk ? 'rgba(34,229,212,.35)' : 'rgba(255,184,74,.35)'}`,
          background: allOk ? 'rgba(34,229,212,.07)' : 'rgba(255,184,74,.07)',
          borderRadius: 999,
          padding: '7px 16px',
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: allOk ? 'var(--success)' : 'var(--warning)' }} />
        {allOk ? 'All systems operational' : 'Some checks failed'}
      </div>

      <h2 className="meta" style={{ fontFamily: 'var(--f-m)', fontSize: '0.68rem', letterSpacing: '.2em', textTransform: 'uppercase', marginBottom: 14 }}>
        Environment checks
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 44 }}>
        <div className="panel" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px' }}>
          <StatusDot ok={dbOk} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Database</div>
            <div className="meta" style={{ fontFamily: 'var(--f-m)', fontSize: '0.66rem', marginTop: 2 }}>DATABASE_URL · Supabase Postgres</div>
          </div>
          <span className="meta" style={{ fontFamily: 'var(--f-m)', fontSize: '0.62rem', letterSpacing: '.1em', textTransform: 'uppercase' }}>{dbOk ? 'Connected' : 'Error'}</span>
        </div>

        <div className="panel" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px' }}>
          <StatusDot ok={resendResult.ok} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Email</div>
            <div className="meta" style={{ fontFamily: 'var(--f-m)', fontSize: '0.66rem', marginTop: 2 }}>RESEND_API_KEY · Resend</div>
          </div>
          <span className="meta" style={{ fontFamily: 'var(--f-m)', fontSize: '0.62rem', letterSpacing: '.1em', textTransform: 'uppercase' }}>{resendResult.label}</span>
        </div>

        <div className="panel" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px' }}>
          <StatusDot ok={kvResult.ok} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>KV / rate limiting</div>
            <div className="meta" style={{ fontFamily: 'var(--f-m)', fontSize: '0.66rem', marginTop: 2 }}>Cloudflare KV</div>
          </div>
          <span className="meta" style={{ fontFamily: 'var(--f-m)', fontSize: '0.62rem', letterSpacing: '.1em', textTransform: 'uppercase' }}>{kvResult.label}</span>
        </div>

        <div className="panel" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px' }}>
          <StatusDot ok={true} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>AI</div>
            <div className="meta" style={{ fontFamily: 'var(--f-m)', fontSize: '0.66rem', marginTop: 2 }}>Cloudflare Workers AI</div>
          </div>
          <span className="meta" style={{ fontFamily: 'var(--f-m)', fontSize: '0.62rem', letterSpacing: '.1em', textTransform: 'uppercase' }}>Built-in binding</span>
        </div>

        <div className="panel" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px' }}>
          <StatusDot ok={stripePresent} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Payments</div>
            <div className="meta" style={{ fontFamily: 'var(--f-m)', fontSize: '0.66rem', marginTop: 2 }}>STRIPE_SECRET_KEY</div>
          </div>
          <span className="meta" style={{ fontFamily: 'var(--f-m)', fontSize: '0.62rem', letterSpacing: '.1em', textTransform: 'uppercase' }}>{stripePresent ? 'Present' : 'Missing'}</span>
        </div>

        {envChecks.map(({ key, ok }) => (
          <div key={key} className="panel" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px' }}>
            <StatusDot ok={ok} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', fontFamily: 'var(--f-m)' }}>{key}</div>
              <div className="meta" style={{ fontFamily: 'var(--f-m)', fontSize: '0.66rem', marginTop: 2 }}>Required environment variable</div>
            </div>
            <span className="meta" style={{ fontFamily: 'var(--f-m)', fontSize: '0.62rem', letterSpacing: '.1em', textTransform: 'uppercase' }}>{ok ? 'Present' : 'Missing'}</span>
          </div>
        ))}
      </div>

      <h2 className="meta" style={{ fontFamily: 'var(--f-m)', fontSize: '0.68rem', letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--warning)', marginBottom: 14 }}>
        Launch readiness
      </h2>
      <div
        style={{
          background: 'rgba(255,184,74,.05)',
          border: '1px solid rgba(255,184,74,.22)',
          borderRadius: 14,
          padding: '20px 22px',
          marginBottom: 44,
        }}
      >
        {launchBlockers.length === 0 ? (
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '9px 0' }}>
            <span style={{ fontFamily: 'var(--f-m)', fontSize: '0.8rem', color: 'var(--success)', flexShrink: 0, marginTop: 1 }}>✓</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>All launch checks passing</div>
              <div className="meta" style={{ fontSize: '0.8rem', marginTop: 2, lineHeight: 1.5 }}>No blockers. Ship it.</div>
            </div>
          </div>
        ) : (
          launchBlockers.map((blocker) => (
            <div key={blocker} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '9px 0' }}>
              <span style={{ fontFamily: 'var(--f-m)', fontSize: '0.8rem', color: 'var(--warning)', flexShrink: 0, marginTop: 1 }}>⚠</span>
              <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{blocker}</div>
            </div>
          ))
        )}
      </div>

      <p className="meta" style={{ marginBottom: 16 }}>
        Checked at {new Date().toUTCString()}
      </p>

      {rateLimitMetrics.length > 0 && (
        <>
          <h2 className="meta" style={{ fontFamily: 'var(--f-m)', fontSize: '0.68rem', letterSpacing: '.2em', textTransform: 'uppercase', marginBottom: 14 }}>
            Rate limits
          </h2>
          <p className="meta" style={{ marginBottom: 12 }}>Top {rateLimitMetrics.length} buckets by request count.</p>
          <div style={{ overflowX: 'auto' }}>
            <div className="panel" style={{ borderRadius: 14, overflow: 'hidden', padding: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--f-m)', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--line-2)', color: 'var(--ink-3)', letterSpacing: '.08em', textTransform: 'uppercase' }}>
                    <th style={{ textAlign: 'left', padding: '12px 18px', fontWeight: 600, fontSize: 10 }}>Bucket key</th>
                    <th style={{ textAlign: 'right', padding: '12px 18px', fontWeight: 600, fontSize: 10 }}>Hits</th>
                  </tr>
                </thead>
                <tbody>
                  {rateLimitMetrics.map((m) => (
                    <tr key={m.bucket} style={{ borderBottom: '1px solid var(--line)' }}>
                      <td style={{ padding: '12px 18px', color: 'var(--ink)', fontFamily: 'monospace', fontSize: 11 }}>{m.bucket}</td>
                      <td style={{ padding: '12px 18px', textAlign: 'right', color: m.hits > 100 ? 'var(--accent-2)' : 'var(--ink)' }}>{m.hits}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

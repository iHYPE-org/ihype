import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { WORKBENCH_PATH } from '@/lib/auth-redirects';
import { isAdminSession } from '@/lib/permissions';
import { db } from '@/lib/db';
import { isAcrCloudConfigured } from '@/lib/acrcloud';
import { getHealthSnapshot } from '@/lib/health';
import { kvPut } from '@/lib/kv';
import { getRateLimitMetrics } from '@/lib/rate-limit';
import { getServerT } from '@/lib/i18n/server';
import { readRuntimeEnv } from '@/lib/runtime-env';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'System Status · iHYPE',
  robots: { index: false, follow: false },
};

const REQUIRED_ENV_VARS = ['RESEND_API_KEY', 'AUTH_SECRET'] as const;

async function checkDb(): Promise<boolean> {
  try {
    await db.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

async function checkResend(): Promise<{ ok: boolean; label: string }> {
  const apiKey = readRuntimeEnv('RESEND_API_KEY');
  if (!apiKey) return { ok: false, label: 'API key missing' };
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(5_000),
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
  const t = await getServerT();
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  if (!isAdminSession(session)) redirect(WORKBENCH_PATH);

  const trLabel = (label: string) => {
    switch (label) {
      case 'Reachable': return t('statusPage.labelReachable', 'Reachable');
      case 'Unreachable': return t('statusPage.labelUnreachable', 'Unreachable');
      case 'API key missing': return t('statusPage.labelApiKeyMissing', 'API key missing');
      case 'Connected': return t('statusPage.labelConnected', 'Connected');
      case 'Error': return t('statusPage.labelError', 'Error');
      default: return label;
    }
  };

  const [dbOk, resendResult, kvResult, rateLimitMetrics, health] = await Promise.all([
    checkDb(),
    checkResend(),
    checkKv(),
    getRateLimitMetrics(50).catch(() => [] as Array<{ bucket: string; hits: number }>),
    getHealthSnapshot()
  ]);

  const envChecks = REQUIRED_ENV_VARS.map((key) => ({
    key,
    ok: Boolean(readRuntimeEnv(key)),
  }));

  const stripePresent = Boolean(readRuntimeEnv('STRIPE_SECRET_KEY'));
  // Both of these degrade silently when absent — copyright fingerprinting
  // falls back to the remaining scan layers, and the rate limiter falls back
  // to a non-atomic KV counter at half the configured limit. Neither state was
  // visible anywhere before; you had to read a scan result or find the error
  // in Sentry. They are reported, not counted toward allOk: the site runs
  // correctly without either, just with less protection than intended.
  const fingerprintConfigured = isAcrCloudConfigured();

  const allOk =
    dbOk &&
    resendResult.ok &&
    stripePresent &&
    envChecks.every((c) => c.ok);
  const launchBlockers = health.status === 'ok' ? health.alphaReadiness.blockers : ['Health snapshot is degraded.'];

  return (
    <div className="container section" style={{ maxWidth: 760 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 10 }}>
        <h1 className="title" style={{ margin: 0 }}>{t('statusPage.title', 'System status')}</h1>
        <span className="meta" style={{ fontFamily: 'var(--f-m)', fontSize: '0.64rem', letterSpacing: '.14em', textTransform: 'uppercase' }}>
          {t('statusPage.adminOnlyNote', 'Admin only · refreshed on load')}
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
          border: `1px solid ${allOk ? 'rgba(var(--role-venue-rgb),.35)' : 'rgba(var(--role-promoter-rgb),.35)'}`,
          background: allOk ? 'rgba(var(--role-venue-rgb),.07)' : 'rgba(var(--role-promoter-rgb),.07)',
          borderRadius: 999,
          padding: '7px 16px',
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: allOk ? 'var(--success)' : 'var(--warning)' }} />
        {allOk ? t('statusPage.allSystemsOperational', 'All systems operational') : t('statusPage.someChecksFailed', 'Some checks failed')}
      </div>

      <h2 className="meta" style={{ fontFamily: 'var(--f-m)', fontSize: '0.68rem', letterSpacing: '.2em', textTransform: 'uppercase', marginBottom: 14 }}>
        {t('statusPage.environmentChecks', 'Environment checks')}
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 44 }}>
        <div className="panel" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px' }}>
          <StatusDot ok={dbOk} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{t('statusPage.database', 'Database')}</div>
            <div className="meta" style={{ fontFamily: 'var(--f-m)', fontSize: '0.66rem', marginTop: 2 }}>{t('statusPage.databaseMeta', 'DATABASE_URL · Supabase Postgres')}</div>
          </div>
          <span className="meta" style={{ fontFamily: 'var(--f-m)', fontSize: '0.62rem', letterSpacing: '.1em', textTransform: 'uppercase' }}>{dbOk ? t('statusPage.labelConnected', 'Connected') : t('statusPage.labelError', 'Error')}</span>
        </div>

        <div className="panel" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px' }}>
          <StatusDot ok={resendResult.ok} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{t('statusPage.email', 'Email')}</div>
            <div className="meta" style={{ fontFamily: 'var(--f-m)', fontSize: '0.66rem', marginTop: 2 }}>{t('statusPage.emailMeta', 'RESEND_API_KEY · Resend')}</div>
          </div>
          <span className="meta" style={{ fontFamily: 'var(--f-m)', fontSize: '0.62rem', letterSpacing: '.1em', textTransform: 'uppercase' }}>{trLabel(resendResult.label)}</span>
        </div>

        <div className="panel" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px' }}>
          <StatusDot ok={kvResult.ok} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{t('statusPage.kvRateLimiting', 'KV / rate limiting')}</div>
            <div className="meta" style={{ fontFamily: 'var(--f-m)', fontSize: '0.66rem', marginTop: 2 }}>{t('statusPage.kvMeta', 'Cloudflare KV')}</div>
          </div>
          <span className="meta" style={{ fontFamily: 'var(--f-m)', fontSize: '0.62rem', letterSpacing: '.1em', textTransform: 'uppercase' }}>{trLabel(kvResult.label)}</span>
        </div>

        <div className="panel" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px' }}>
          <StatusDot ok={true} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{t('statusPage.ai', 'AI')}</div>
            <div className="meta" style={{ fontFamily: 'var(--f-m)', fontSize: '0.66rem', marginTop: 2 }}>{t('statusPage.aiMeta', 'Cloudflare Workers AI')}</div>
          </div>
          <span className="meta" style={{ fontFamily: 'var(--f-m)', fontSize: '0.62rem', letterSpacing: '.1em', textTransform: 'uppercase' }}>{t('statusPage.builtInBinding', 'Built-in binding')}</span>
        </div>

        <div className="panel" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px' }}>
          <StatusDot ok={fingerprintConfigured} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{t('statusPage.fingerprinting', 'Copyright fingerprinting')}</div>
            <div className="meta" style={{ fontFamily: 'var(--f-m)', fontSize: '0.66rem', marginTop: 2 }}>{t('statusPage.fingerprintingMeta', 'ACRCLOUD_HOST / ACCESS_KEY / ACCESS_SECRET · ACRCloud')}</div>
          </div>
          <span className="meta" style={{ fontFamily: 'var(--f-m)', fontSize: '0.62rem', letterSpacing: '.1em', textTransform: 'uppercase' }}>
            {fingerprintConfigured
              ? t('statusPage.labelConfigured', 'Configured')
              : t('statusPage.labelScanLayerOff', 'Not configured · scan layer off')}
          </span>
        </div>

        <div className="panel" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px' }}>
          <StatusDot ok={stripePresent} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{t('statusPage.payments', 'Payments')}</div>
            <div className="meta" style={{ fontFamily: 'var(--f-m)', fontSize: '0.66rem', marginTop: 2 }}>{t('statusPage.paymentsMeta', 'STRIPE_SECRET_KEY')}</div>
          </div>
          <span className="meta" style={{ fontFamily: 'var(--f-m)', fontSize: '0.62rem', letterSpacing: '.1em', textTransform: 'uppercase' }}>{stripePresent ? t('statusPage.present', 'Present') : t('statusPage.missing', 'Missing')}</span>
        </div>

        {envChecks.map(({ key, ok }) => (
          <div key={key} className="panel" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px' }}>
            <StatusDot ok={ok} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', fontFamily: 'var(--f-m)' }}>{key}</div>
              <div className="meta" style={{ fontFamily: 'var(--f-m)', fontSize: '0.66rem', marginTop: 2 }}>{t('statusPage.requiredEnvVar', 'Required environment variable')}</div>
            </div>
            <span className="meta" style={{ fontFamily: 'var(--f-m)', fontSize: '0.62rem', letterSpacing: '.1em', textTransform: 'uppercase' }}>{ok ? t('statusPage.present', 'Present') : t('statusPage.missing', 'Missing')}</span>
          </div>
        ))}
      </div>

      <h2 className="meta" style={{ fontFamily: 'var(--f-m)', fontSize: '0.68rem', letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--warning)', marginBottom: 14 }}>
        {t('statusPage.alphaReadiness', 'Alpha readiness')}
      </h2>
      <div
        style={{
          background: 'rgba(var(--role-promoter-rgb),.05)',
          border: '1px solid rgba(var(--role-promoter-rgb),.22)',
          borderRadius: 14,
          padding: '20px 22px',
          marginBottom: 44,
        }}
      >
        {launchBlockers.length === 0 ? (
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '9px 0' }}>
            <span style={{ fontFamily: 'var(--f-m)', fontSize: '0.8rem', color: 'var(--success)', flexShrink: 0, marginTop: 1 }}>✓</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{t('statusPage.allAlphaChecksPassing', 'All alpha checks passing')}</div>
              <div className="meta" style={{ fontSize: '0.8rem', marginTop: 2, lineHeight: 1.5 }}>{t('statusPage.noBlockersShipIt', 'No blockers. Ship it.')}</div>
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
        {t('statusPage.checkedAt', 'Checked at')} {new Date().toUTCString()}
      </p>

      {rateLimitMetrics.length > 0 && (
        <>
          <h2 className="meta" style={{ fontFamily: 'var(--f-m)', fontSize: '0.68rem', letterSpacing: '.2em', textTransform: 'uppercase', marginBottom: 14 }}>
            {t('statusPage.rateLimits', 'Rate limits')}
          </h2>
          <p className="meta" style={{ marginBottom: 12 }}>{t('statusPage.topBucketsPrefix', 'Top')} {rateLimitMetrics.length} {t('statusPage.topBucketsSuffix', 'buckets by request count.')}</p>
          <div style={{ overflowX: 'auto' }}>
            <div className="panel" style={{ borderRadius: 14, overflow: 'hidden', padding: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--f-m)', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--line-2)', color: 'var(--ink-3)', letterSpacing: '.08em', textTransform: 'uppercase' }}>
                    <th style={{ textAlign: 'left', padding: '12px 18px', fontWeight: 600, fontSize: 10 }}>{t('statusPage.bucketKey', 'Bucket key')}</th>
                    <th style={{ textAlign: 'right', padding: '12px 18px', fontWeight: 600, fontSize: 10 }}>{t('statusPage.hits', 'Hits')}</th>
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

import Link from 'next/link';
import { AdminSignupTestPanel } from '@/components/AdminSignupTestPanel';
import type { User } from '@prisma/client';

type UserSearchResult = Pick<User, 'id' | 'email' | 'username' | 'role' | 'createdAt'> & {
  profiles: { type: string; slug: string }[];
};

interface Props {
  userCount: number;
  profileCount: number;
  pendingVerificationCount: number;
  openReportCount: number;
  openSupportCount: number;
  mediaCount: number;
  ticketOrderCount: number;
  userSearch?: string;
  userSearchResults: UserSearchResult[];
  health: { status: string; latencyMs: number };
  healthOperations: { failedEmails24h: number; reservedTicketOrders: number } | null;
  healthIntegrations: { ticketPaymentCapture: boolean } | null;
  funnelAlerts: string[];
  funnelDropoff: ReadonlyArray<readonly [string, number]>;
  variantCounts: Record<string, { views: number; accounts: number }>;
  passkeyDiagnostics: Array<{ action: string; meta: Record<string, unknown> }>;
  rateLimitMetrics: Array<{ bucket: string; hits: number }>;
}

function metaText(meta: Record<string, unknown>, key: string) {
  const value = meta[key];
  return typeof value === 'string' && value.trim() ? value : 'n/a';
}

export function TabDashboardHero({
  userCount,
  profileCount,
  pendingVerificationCount,
  openReportCount,
  openSupportCount,
  mediaCount,
  ticketOrderCount,
  userSearch,
  userSearchResults,
  health,
  healthOperations,
  healthIntegrations,
  funnelAlerts,
  funnelDropoff,
  variantCounts,
  passkeyDiagnostics,
  rateLimitMetrics,
}: Props) {
  return (
    <>
      <section className="panel admin-console-hero">
        <div>
          <div className="badge">Admin beta console</div>
          <h1>Trust, launch, and support signals</h1>
          <p className="subtitle">
            One place to watch account growth, verification, email/MFA delivery, reports, tickets, media, and audit
            events during beta.
          </p>
        </div>
        <div className="cta-row">
          <Link className="button" href="/admin/users">
            User management
          </Link>
          <Link className="button" href="/admin/broadcast">
            Broadcast email
          </Link>
          <Link className="button secondary" href="/transparency">
            Transparency
          </Link>
          <Link className="button secondary" href="/about">
            About iHYPE
          </Link>
        </div>
      </section>

      <section className="panel admin-console-panel">
        <div className="admin-console-panel-head">
          <div>
            <h2>User search</h2>
            <p className="meta">Search by email or username.</p>
          </div>
        </div>
        <form method="GET" style={{ display: 'flex', gap: 8, marginBottom: userSearchResults.length ? 16 : 0 }}>
          <input
            name="userSearch"
            defaultValue={userSearch ?? ''}
            placeholder="Email or username…"
            style={{ flex: 1, padding: '8px 12px', borderRadius: 7, border: '1px solid var(--line2, #333)', background: 'var(--bg2, #111)', color: 'inherit', fontSize: 14 }}
          />
          <button type="submit" className="button small secondary">Search</button>
          {userSearch && <Link className="button small secondary" href="/admin">Clear</Link>}
        </form>
        {userSearchResults.length > 0 && (
          <div className="admin-list">
            {userSearchResults.map(u => (
              <div className="admin-list-row" key={u.id}>
                <span>{u.username ?? u.email}</span>
                <strong>{u.role}</strong>
                <small>{u.email}</small>
                <small>{u.profiles.map(p => p.type).join(', ') || 'no profiles'}</small>
                <small>{u.createdAt.toISOString().slice(0, 10)}</small>
              </div>
            ))}
          </div>
        )}
        {userSearch && userSearchResults.length === 0 && (
          <div className="empty">No users found for &ldquo;{userSearch}&rdquo;.</div>
        )}
      </section>

      <section className="admin-metric-grid">
        {[
          ['Users', userCount],
          ['Profiles', profileCount],
          ['Pending verification', pendingVerificationCount],
          ['Open reports', openReportCount],
          ['Support requests', openSupportCount],
          ['Media assets', mediaCount],
          ['Ticket orders', ticketOrderCount]
        ].map(([label, value]) => (
          <article className="card admin-metric-card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>

      <section className="panel admin-console-panel">
        <div className="admin-console-panel-head">
          <div>
            <h2>QA role perspectives</h2>
            <p className="meta">
              Switch from the header or open a role lane directly to verify the signed-in experience.
            </p>
          </div>
        </div>
        <div className="admin-export-row" aria-label="Admin QA role views">
          <Link className="button small secondary" href="/fans?module=tool-hub">Fan QA</Link>
          <Link className="button small secondary" href="/artists?module=tool-hub">Artist QA</Link>
          <Link className="button small secondary" href="/promoters?module=tool-hub">Promoter QA</Link>
          <Link className="button small secondary" href="/venues?module=tool-hub">Venue QA</Link>
        </div>
      </section>

      <section className="panel admin-console-panel admin-health-panel">
        <div className="admin-console-panel-head">
          <div>
            <h2>Launch health</h2>
            <p className="meta">
              Public uptime endpoint: <Link className="text-link" href="/api/health">/api/health</Link>
            </p>
          </div>
          <strong className={health.status === 'ok' ? 'admin-health-status ok' : 'admin-health-status warn'}>
            {health.status}
          </strong>
        </div>
        <div className="admin-health-grid">
          <div className="admin-health-card">
            <span>DB latency</span>
            <strong>{health.latencyMs}ms</strong>
          </div>
          <div className="admin-health-card">
            <span>Failed email 24h</span>
            <strong>{healthOperations ? healthOperations.failedEmails24h : 'n/a'}</strong>
          </div>
          <div className="admin-health-card">
            <span>Reserved tickets</span>
            <strong>{healthOperations ? healthOperations.reservedTicketOrders : 'n/a'}</strong>
          </div>
          <div className="admin-health-card">
            <span>Payment capture</span>
            <strong>{healthIntegrations?.ticketPaymentCapture ? 'Ready' : 'Blocked'}</strong>
          </div>
        </div>
      </section>

      <section className="panel admin-console-panel">
        <div className="admin-console-panel-head">
          <div>
            <h2>Signup funnel</h2>
            <p className="meta">Last 7 days from audit events. Use this to spot passkey/email dropoff.</p>
          </div>
          <div className="admin-signup-actions">
            <AdminSignupTestPanel />
            <Link className="button small secondary" href="/register?role=ARTIST">
              Test signup UI
            </Link>
          </div>
        </div>
        {funnelAlerts.length ? (
          <div className="admin-alert-row">
            {funnelAlerts.map((alert) => <span key={alert}>{alert}</span>)}
          </div>
        ) : (
          <div className="admin-alert-row admin-alert-row-ok"><span>No signup alerts in the 7d funnel window.</span></div>
        )}
        <div className="admin-health-grid">
          {funnelDropoff.map(([label, value]) => (
            <div className="admin-health-card" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
        {Object.keys(variantCounts).length ? (
          <div className="admin-variant-grid">
            {Object.entries(variantCounts).map(([variant, counts]) => (
              <div className="admin-health-card" key={variant}>
                <span>{variant.replace('_', ' ')}</span>
                <strong>{counts.accounts}/{counts.views}</strong>
              </div>
            ))}
          </div>
        ) : null}
        <div className="admin-diagnostic-list">
          <strong>Passkey diagnostics</strong>
          {passkeyDiagnostics.length ? passkeyDiagnostics.map(({ action, meta }, index) => (
            <div className="admin-diagnostic-row" key={`${action}-${index}`}>
              <span>{action}</span>
              <small>{metaText(meta, 'browser')} / {metaText(meta, 'platform')} / {metaText(meta, 'webauthn')} / {metaText(meta, 'errorName')}</small>
              <em>{metaText(meta, 'reason')}</em>
            </div>
          )) : <p className="meta">No recent passkey failures captured.</p>}
        </div>
      </section>

      <section className="panel admin-console-panel">
        <div className="admin-console-panel-head">
          <div>
            <h2>Rate limit hits (1h)</h2>
            <p className="meta">Top buckets that returned 429 in the last hour.</p>
          </div>
        </div>
        <div className="admin-list">
          {rateLimitMetrics.length ? (
            rateLimitMetrics.map((row) => (
              <div className="admin-list-row" key={row.bucket}>
                <span style={{ fontFamily: 'var(--f-mono, monospace)', fontSize: 12 }}>{row.bucket}</span>
                <strong>{row.hits}</strong>
              </div>
            ))
          ) : (
            <div className="empty">No rate limit hits in the last hour.</div>
          )}
        </div>
      </section>
    </>
  );
}

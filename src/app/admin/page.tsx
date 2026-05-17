import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminSignupTestPanel } from '@/components/AdminSignupTestPanel';
import { redirect } from 'next/navigation';
import { AdminReportActions, AdminVerificationActions } from '@/components/AdminModerationActions';
import { AdminNav } from '@/components/AdminNav';
import { AdminFeatureFlags } from '@/components/AdminFeatureFlags';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getHealthSnapshot } from '@/lib/health';
import { getRateLimitMetrics } from '@/lib/rate-limit';
import { isBlobMediaStorageConfigured } from '@/lib/media-storage';
import { isPaymentProcessingConfigured } from '@/lib/payments';
import { isAdminSession } from '@/lib/permissions';
import {
  areDemoLoginsEnabledRuntime,
  areLiveStreamsEnabledRuntime,
  getRuntimeFlag,
  isInviteCodeRequiredRuntime,
  shouldHideDemoContentRuntime
} from '@/lib/runtime-flags';
import { featureShowAction } from './users/actions';

export const metadata: Metadata = {
  title: 'Admin Beta Console | iHYPE.org',
  robots: { index: false, follow: false }
};

function statusLabel(value: boolean) {
  return value ? 'Enabled' : 'Off';
}

function auditMeta(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function metaText(meta: Record<string, unknown>, key: string) {
  const value = meta[key];
  return typeof value === 'string' && value.trim() ? value : 'n/a';
}

export default async function AdminPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  if (!isAdminSession(session)) {
    redirect('/auth/landing');
  }

  const funnelSince = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [
    userCount,
    profileCount,
    pendingVerificationCount,
    openReportCount,
    openSupportCount,
    mediaCount,
    ticketOrderCount,
    recentReports,
    recentSupport,
    pendingVerifications,
    recentEmails,
    recentAudits,
    recentUsers,
    signupFunnelAudits,
    health,
    recentTicketOrders,
    revenueAgg,
    recentShows
  ] = await Promise.all([
    db.user.count(),
    db.profile.count(),
    db.profile.count({ where: { verificationStatus: 'PENDING' } }),
    db.contentReport.count({ where: { status: 'OPEN' } }),
    db.supportRequest.count({ where: { status: 'OPEN' } }),
    db.artistMediaAsset.count(),
    db.ticketOrder.count(),
    db.contentReport.findMany({
      orderBy: { createdAt: 'desc' },
      take: 6,
      include: { reporter: { select: { email: true, username: true } } }
    }),
    db.supportRequest.findMany({
      orderBy: { createdAt: 'desc' },
      take: 6
    }),
    db.profile.findMany({
      where: { verificationStatus: 'PENDING' },
      orderBy: { verificationSubmittedAt: 'desc' },
      take: 6,
      select: {
        id: true,
        name: true,
        type: true,
        contactInfo: true,
        verificationNotes: true,
        verificationSubmittedAt: true
      }
    }),
    db.emailDeliveryLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 6
    }),
    db.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: { actor: { select: { email: true, username: true } } }
    }),
    db.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: { email: true, username: true, role: true, createdAt: true }
    }),
    db.auditLog.findMany({
      where: { action: { startsWith: 'signup_funnel:' }, createdAt: { gte: funnelSince } },
      orderBy: { createdAt: 'desc' },
      take: 250,
      select: { action: true, metadata: true }
    }),
    getHealthSnapshot(),
    db.ticketOrder.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: { show: { select: { title: true } } }
    }),
    db.ticketOrder.aggregate({
      where: { status: 'CAPTURED' },
      _sum: { totalChargeCents: true }
    }),
    db.show.findMany({
      take: 8,
      orderBy: { createdAt: 'desc' },
      include: {
        venueProfile: { select: { name: true } },
        _count: { select: { tickets: true } }
      }
    })
  ]);

  const [
    demoLoginsEnabled,
    inviteOnlySignupEnabled,
    demoContentHidden,
    liveStreamsEnabled,
    blobMediaStorageEnabled,
    ticketPaymentCaptureEnabled
  ] = await Promise.all([
    areDemoLoginsEnabledRuntime(),
    isInviteCodeRequiredRuntime(),
    shouldHideDemoContentRuntime(),
    areLiveStreamsEnabledRuntime(),
    getRuntimeFlag('blob_media_storage', isBlobMediaStorageConfigured()),
    getRuntimeFlag('ticket_payment_capture', isPaymentProcessingConfigured())
  ]);
  const featureFlags = [
    { key: 'demo_logins', label: 'Demo logins', enabled: demoLoginsEnabled },
    { key: 'invite_only_signup', label: 'Invite-only signup', enabled: inviteOnlySignupEnabled },
    { key: 'hide_demo_content', label: 'Hide demo content', enabled: demoContentHidden },
    { key: 'live_streams', label: 'Live streams', enabled: liveStreamsEnabled },
    { key: 'blob_media_storage', label: 'Blob media storage', enabled: blobMediaStorageEnabled },
    { key: 'ticket_payment_capture', label: 'Ticket payment capture', enabled: ticketPaymentCaptureEnabled }
  ];
  const rateLimitMetrics = await getRateLimitMetrics(10);
  const revenueCents = revenueAgg._sum.totalChargeCents ?? 0;
  const revenueLabel = `$${(revenueCents / 100).toFixed(2)}`;
  const healthOperations = health.status === 'ok' ? health.operations : null;
  const healthIntegrations = health.status === 'ok' ? health.integrations : null;
  const funnelCounts = signupFunnelAudits.reduce<Record<string, number>>((counts, event) => {
    const key = event.action.replace('signup_funnel:', '');
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
  const funnelDropoff = [
    ['Views', funnelCounts.view ?? 0],
    ['Submits', funnelCounts.submit ?? 0],
    ['Accounts', funnelCounts.account_created ?? 0],
    ['Passkey success', funnelCounts.passkey_success ?? 0],
    ['Email success', funnelCounts.email_code_success ?? 0]
  ] as const;
  const passkeyFailureCount = (funnelCounts.passkey_failed ?? 0) + (funnelCounts.passkey_retry_failed ?? 0) + (funnelCounts.login_passkey_failed ?? 0);
  const emailFailureCount = (funnelCounts.email_code_failed ?? 0) + (funnelCounts.email_code_verify_failed ?? 0) + (funnelCounts.login_email_code_failed ?? 0);
  const abandonedAfterView = Math.max(0, (funnelCounts.view ?? 0) - (funnelCounts.account_created ?? 0));
  const funnelAlerts = [
    passkeyFailureCount > 0 ? `${passkeyFailureCount} passkey failure${passkeyFailureCount === 1 ? '' : 's'} in 7d` : null,
    emailFailureCount > 0 ? `${emailFailureCount} email-code issue${emailFailureCount === 1 ? '' : 's'} in 7d` : null,
    abandonedAfterView > 5 ? `${abandonedAfterView} visitors viewed signup without creating an account` : null
  ].filter((alert): alert is string => Boolean(alert));
  const variantCounts = signupFunnelAudits.reduce<Record<string, { views: number; accounts: number }>>((counts, event) => {
    const meta = auditMeta(event.metadata);
    const variant = metaText(meta, 'variant');
    if (variant === 'n/a') return counts;
    counts[variant] ??= { views: 0, accounts: 0 };
    if (event.action.endsWith(':view')) counts[variant].views += 1;
    if (event.action.endsWith(':account_created')) counts[variant].accounts += 1;
    return counts;
  }, {});
  const passkeyDiagnostics = signupFunnelAudits
    .filter((event) => event.action.includes('passkey') && event.action.includes('failed'))
    .slice(0, 5)
    .map((event) => ({ action: event.action.replace('signup_funnel:', ''), meta: auditMeta(event.metadata) }));

  return (
    <main className="container section admin-console">
      <AdminNav active="dashboard" />
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

      <section className="admin-metric-grid">
        <article className="card admin-metric-card">
          <span>Revenue (captured)</span>
          <strong>{revenueLabel}</strong>
        </article>
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
          <Link className="button small secondary" href="/fans?module=tool-hub">
            Fan QA
          </Link>
          <Link className="button small secondary" href="/artists?module=tool-hub">
            Artist QA
          </Link>
          <Link className="button small secondary" href="/promoters?module=tool-hub">
            Promoter QA
          </Link>
          <Link className="button small secondary" href="/venues?module=tool-hub">
            Venue QA
          </Link>
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
            <p className="meta">Top buckets that returned 429 in the last hour. Requires Vercel KV.</p>
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

      <section className="grid grid-2 admin-console-grid">
        <article className="panel admin-console-panel">
          <h2>Feature flags</h2>
          <div className="admin-export-row" aria-label="Admin CSV exports">
            {(['reports', 'support', 'verifications', 'tickets', 'audits'] as const).map((kind) => (
              <Link className="button small secondary" href={`/api/admin/export/${kind}`} key={kind}>
                Export {kind}
              </Link>
            ))}
          </div>
          <AdminFeatureFlags initialFlags={featureFlags} />
        </article>

        <article className="panel admin-console-panel">
          <h2>Ticket orders</h2>
          <div className="admin-list">
            {recentTicketOrders.length ? (
              recentTicketOrders.map((order) => (
                <div className="admin-list-row" key={order.id}>
                  <span>{order.show?.title ?? 'Unknown show'}</span>
                  <strong>{order.status}</strong>
                  <small>{order.buyerEmail} · ${(order.totalChargeCents / 100).toFixed(2)}</small>
                </div>
              ))
            ) : (
              <div className="empty">No ticket orders yet.</div>
            )}
          </div>
        </article>

        <article className="panel admin-console-panel">
          <h2>Recent shows</h2>
          <div className="admin-list">
            {recentShows.length ? (
              recentShows.map((show) => (
                <div className="admin-list-row" key={show.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ flex: 1 }}>{show.title}</span>
                  <small>{show.venueProfile?.name ?? '—'}</small>
                  <small>{show.startsAt.toISOString().slice(0, 10)}</small>
                  <small>{show._count.tickets} tix</small>
                  <form action={featureShowAction}>
                    <input type="hidden" name="showId" value={show.id} />
                    <button className="button small secondary" type="submit">Feature</button>
                  </form>
                </div>
              ))
            ) : (
              <div className="empty">No shows yet.</div>
            )}
          </div>
        </article>

        <article className="panel admin-console-panel">
          <h2>Recent users</h2>
          <div className="admin-list">
            {recentUsers.map((user) => (
              <div className="admin-list-row" key={user.email}>
                <span>{user.username || user.email}</span>
                <strong>{user.role}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="panel admin-console-panel">
          <h2>Content reports</h2>
          <div className="admin-list">
            {recentReports.length ? (
              recentReports.map((report) => (
                <div className="admin-list-row" key={report.id}>
                  <span>{report.reason}</span>
                  <strong>{report.status}</strong>
                  <small>
                    {report.targetType}:{report.targetId} by {report.reporter?.username ?? report.reporter?.email ?? 'unknown'}
                  </small>
                  <AdminReportActions reportId={report.id} />
                </div>
              ))
            ) : (
              <div className="empty">No reports yet.</div>
            )}
          </div>
        </article>

        <article className="panel admin-console-panel">
          <h2>Support requests</h2>
          <div className="admin-list">
            {recentSupport.length ? (
              recentSupport.map((request) => (
                <div className="admin-list-row" key={request.id}>
                  <span>{request.subject}</span>
                  <strong>{request.priority}</strong>
                  <small>
                    {request.type} | {request.status} | {request.email ?? request.name ?? 'anonymous'}
                  </small>
                </div>
              ))
            ) : (
              <div className="empty">No support requests yet.</div>
            )}
          </div>
        </article>

        <article className="panel admin-console-panel">
          <h2>Verification queue</h2>
          <div className="admin-list">
            {pendingVerifications.length ? (
              pendingVerifications.map((profile) => (
                <div className="admin-list-row" key={profile.id}>
                  <span>{profile.name}</span>
                  <strong>{profile.type === 'DJ' ? 'PROMOTER' : profile.type}</strong>
                  <small>{profile.contactInfo || profile.verificationNotes || 'No details provided'}</small>
                  <AdminVerificationActions profileId={profile.id} />
                </div>
              ))
            ) : (
              <div className="empty">No pending verification requests.</div>
            )}
          </div>
        </article>

        <article className="panel admin-console-panel">
          <h2>Email/MFA delivery</h2>
          <div className="admin-list">
            {recentEmails.length ? (
              recentEmails.map((email) => (
                <div className="admin-list-row" key={email.id}>
                  <span>{email.type}</span>
                  <strong>{email.status}</strong>
                  <small>{email.recipient}</small>
                </div>
              ))
            ) : (
              <div className="empty">No email delivery records yet.</div>
            )}
          </div>
        </article>

        <article className="panel admin-console-panel admin-console-panel-wide">
          <h2>Audit log</h2>
          <div className="admin-list">
            {recentAudits.length ? (
              recentAudits.map((audit) => (
                <div className="admin-list-row" key={audit.id}>
                  <span>{audit.action}</span>
                  <strong>{audit.entityType}</strong>
                  <small>{audit.actor?.username ?? audit.actor?.email ?? 'system'} | {audit.entityId ?? 'no id'}</small>
                </div>
              ))
            ) : (
              <div className="empty">No audit events yet.</div>
            )}
          </div>
        </article>
      </section>

      <section className="section">
        <h2>Backups</h2>
        <article className="panel" style={{ padding: '1rem 1.25rem' }}>
          <p className="meta" style={{ marginTop: 0 }}>
            iHYPE does not currently run an automated database backup job. Postgres backups should be
            taken from the managed provider dashboard on a regular cadence (daily for production).
          </p>
          <ul style={{ paddingLeft: '1.2rem', margin: '0.5rem 0', lineHeight: 1.6 }}>
            <li>
              <strong>Neon:</strong>{' '}
              <a href="https://console.neon.tech/" rel="noopener noreferrer" target="_blank">
                console.neon.tech
              </a>{' '}
              — branch the production database for point-in-time snapshots.
            </li>
            <li>
              <strong>Vercel:</strong>{' '}
              <a href="https://vercel.com/dashboard" rel="noopener noreferrer" target="_blank">
                vercel.com/dashboard
              </a>{' '}
              — review storage integration logs and exports.
            </li>
            <li>
              For ad-hoc exports run <code>pg_dump &quot;$DATABASE_URL&quot; &gt; ihype-backup.sql</code>{' '}
              from a trusted workstation.
            </li>
          </ul>
          <p className="meta" style={{ marginBottom: 0 }}>
            Note: an R2/S3-backed automated rotation job is planned but intentionally not wired up yet —
            this section is informational so admins know where to look.
          </p>
        </article>
      </section>
    </main>
  );
}

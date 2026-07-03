import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminSignupTestPanel } from '@/components/AdminSignupTestPanel';
import { redirect } from 'next/navigation';
import { AdminReportActions, AdminVerificationActions } from '@/components/AdminModerationActions';
import { AdminFeatureFlags } from '@/components/AdminFeatureFlags';
import { FeatureToggle } from '@/components/admin/FeatureToggle';
import { BulkActions } from '@/components/admin/BulkActions';
import { SocialPostCopy } from '@/components/admin/SocialPostCopy';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getHealthSnapshot } from '@/lib/health';
import { getRateLimitMetrics } from '@/lib/rate-limit';
import { isBlobMediaStorageConfigured } from '@/lib/media-storage';
import { isPaymentProcessingConfigured } from '@/lib/payments';
import { isAdminSession } from '@/lib/permissions';
import { WORKBENCH_PATH } from '@/lib/auth-redirects';
import {
  areDemoLoginsEnabledRuntime,
  getRuntimeFlag,
  isInviteCodeRequiredRuntime,
  shouldHideDemoContentRuntime
} from '@/lib/runtime-flags';


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

export default async function AdminPage({ searchParams }: { searchParams?: Promise<{ userSearch?: string }> }) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  if (!isAdminSession(session)) {
    redirect(WORKBENCH_PATH);
  }

  const { userSearch } = searchParams ? await searchParams : {};
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
    recentShows,
    recentSpamFlags,
    recentLoginsCount,
    userSearchResults,
    recentInviteCodes,
    funnelStage1,
    funnelStage2,
    funnelStage3,
    funnelStage1Recent,
    recentSocialPosts,
    calendarShows,
  ] = await Promise.all([
    db.user.count().catch(() => 0),
    db.profile.count().catch(() => 0),
    db.profile.count({ where: { verificationStatus: 'PENDING' } }).catch(() => 0),
    db.contentReport.count({ where: { status: 'OPEN' } }).catch(() => 0),
    db.supportRequest.count({ where: { status: 'OPEN' } }).catch(() => 0),
    db.artistMediaAsset.count().catch(() => 0),
    db.ticketOrder.count().catch(() => 0),
    db.contentReport.findMany({
      orderBy: { createdAt: 'desc' },
      take: 6,
      include: { reporter: { select: { email: true, username: true } } }
    }).catch(() => []),
    db.supportRequest.findMany({
      orderBy: { createdAt: 'desc' },
      take: 6
    }).catch(() => []),
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
    }).catch(() => []),
    db.emailDeliveryLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 6
    }).catch(() => []),
    db.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: { actor: { select: { email: true, username: true } } }
    }).catch(() => []),
    db.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: { email: true, username: true, role: true, createdAt: true }
    }).catch(() => []),
    db.auditLog.findMany({
      where: { action: { startsWith: 'signup_funnel:' }, createdAt: { gte: funnelSince } },
      orderBy: { createdAt: 'desc' },
      take: 250,
      select: { action: true, metadata: true }
    }).catch(() => []),
    getHealthSnapshot(),
    db.ticketOrder.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: { show: { select: { title: true } } }
    }).catch(() => []),
    db.ticketOrder.aggregate({
      where: { status: 'CAPTURED' },
      _sum: { totalChargeCents: true }
    }).catch(() => ({ _sum: { totalChargeCents: null } })),
    db.show.findMany({
      take: 8,
      orderBy: { createdAt: 'desc' },
      include: {
        venueProfile: { select: { name: true } },
        _count: { select: { tickets: true } }
      }
    }).catch(() => []),
    db.notification.findMany({
      where: { type: 'SPAM_FLAG', createdAt: { gte: new Date(Date.now() - 86400000) } },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { user: { select: { email: true, username: true } } }
    }).catch(() => []),
    db.user.count({ where: { lastLoginAt: { gte: new Date(Date.now() - 86400000) } } }).catch(() => 0),
    userSearch ? db.user.findMany({
      where: { OR: [
        { email: { contains: userSearch, mode: 'insensitive' } },
        { username: { contains: userSearch, mode: 'insensitive' } }
      ]},
      select: { id: true, email: true, username: true, role: true, createdAt: true, profiles: { select: { type: true, slug: true } } },
      take: 10,
    }).catch(() => []) : Promise.resolve([]),
    db.inviteCode.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
    }).catch(() => []),
    // Artist funnel — stage 1
    db.profile.count({ where: { type: 'ARTIST', mediaUploads: { none: {} } } }).catch(() => 0),
    // Artist funnel — stage 2
    db.profile.count({ where: { type: 'ARTIST', mediaUploads: { some: {} }, hostedShows: { none: {} }, headlinerShows: { none: {} } } }).catch(() => 0),
    // Artist funnel — stage 3
    db.show.count({ where: { hypeCount: 0, status: { not: 'DRAFT' } } }).catch(() => 0),
    // Recent stage-1 artists
    db.profile.findMany({ where: { type: 'ARTIST', mediaUploads: { none: {} } }, select: { name: true, slug: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 5 }).catch(() => []),
    // Recent social posts
    db.socialPost.findMany({ orderBy: { generatedAt: 'desc' }, take: 5 }).catch(() => []),
    // Upcoming calendar (next 30 days)
    db.show.findMany({
      where: { status: 'SCHEDULED', startsAt: { gte: new Date(), lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } },
      select: { id: true, title: true, startsAt: true, featured: true, venueProfile: { select: { name: true } }, headlinerProfile: { select: { name: true } }, ticketsSoldCount: true, ticketCapacity: true },
      orderBy: { startsAt: 'asc' },
      take: 100,
    }).catch(() => [] as Array<{ id: string; title: string; startsAt: Date; featured: boolean; venueProfile: { name: string } | null; headlinerProfile: { name: string } | null; ticketsSoldCount: number; ticketCapacity: number | null }>),
  ]);

  const [
    monthlyRevenue,
    topEarners,
    payoutTotals,
    pendingAds,
    abTests,
  ] = await Promise.all([
    // Monthly revenue: last 12 months
    db.ticketOrder.findMany({
      where: { status: 'CAPTURED', chargedAt: { gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) } },
      select: { chargedAt: true, totalChargeCents: true },
    }).catch(() => [] as { chargedAt: Date | null; totalChargeCents: number }[]),
    // Top earners by profileId
    db.accountsPayableEntry.groupBy({
      by: ['profileId'],
      where: { profileId: { not: null } },
      _sum: { amountCents: true },
      orderBy: { _sum: { amountCents: 'desc' } },
      take: 10,
    }).catch(() => []),
    // Payout totals
    db.accountsPayableEntry.groupBy({
      by: ['status'],
      _sum: { amountCents: true },
    }).catch(() => []),
    // Pending ads
    db.ad.findMany({
      where: { status: 'PENDING' },
      include: { advertiser: { select: { email: true, username: true } }, slot: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }).catch(() => []),
    // A/B tests
    db.aBTest.findMany({ orderBy: { createdAt: 'desc' } }).catch(() => []),
  ]);

  const [
    demoLoginsEnabled,
    inviteOnlySignupEnabled,
    demoContentHidden,
    blobMediaStorageEnabled,
    ticketPaymentCaptureEnabled
  ] = await Promise.all([
    areDemoLoginsEnabledRuntime(),
    isInviteCodeRequiredRuntime(),
    shouldHideDemoContentRuntime(),
    getRuntimeFlag('blob_media_storage', isBlobMediaStorageConfigured()),
    getRuntimeFlag('ticket_payment_capture', isPaymentProcessingConfigured())
  ]);
  const featureFlags = [
    { key: 'demo_logins', label: 'Demo logins', enabled: demoLoginsEnabled },
    { key: 'invite_only_signup', label: 'Invite-only signup', enabled: inviteOnlySignupEnabled },
    { key: 'hide_demo_content', label: 'Hide demo content', enabled: demoContentHidden },
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

  // Monthly revenue computation
  const monthlyMap: Record<string, number> = {};
  for (const order of monthlyRevenue) {
    if (!order.chargedAt) continue;
    const key = `${order.chargedAt.getFullYear()}-${String(order.chargedAt.getMonth() + 1).padStart(2, '0')}`;
    monthlyMap[key] = (monthlyMap[key] ?? 0) + order.totalChargeCents;
  }
  const monthlyRows = Object.entries(monthlyMap).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12);

  // Payout totals
  const payoutPaid = payoutTotals.find(p => p.status === 'RELEASED')?._sum.amountCents ?? 0;
  const payoutPending = payoutTotals.find(p => p.status === 'PENDING')?._sum.amountCents ?? 0;
  const platformFeeTotal = Math.round((revenueCents * 0.1)); // rough 10% estimate

  return (
    <main className="container section admin-console">
      <section className="panel admin-console-hero">
        <div>
          <div className="badge">Admin beta console</div>
          <h1>Admin Console</h1>
          <p className="subtitle">
            Platform management · iH/OPS — account growth, verification, email/MFA delivery, reports, tickets,
            media, and audit events during beta.
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
          <h2>Needs attention</h2>
        </div>
        <div className="admin-health-grid">
          <Link className="admin-health-card" href="/admin/review?tab=verifications">
            <span>Pending verifications</span>
            <strong className={pendingVerificationCount > 0 ? 'admin-health-status warn' : 'admin-health-status ok'}>{pendingVerificationCount}</strong>
          </Link>
          <Link className="admin-health-card" href="/admin/review?tab=reports">
            <span>Open reports</span>
            <strong className={openReportCount > 0 ? 'admin-health-status warn' : 'admin-health-status ok'}>{openReportCount}</strong>
          </Link>
          <Link className="admin-health-card" href="/admin#support-requests">
            <span>Open support requests</span>
            <strong className={openSupportCount > 0 ? 'admin-health-status warn' : 'admin-health-status ok'}>{openSupportCount}</strong>
          </Link>
          <Link className="admin-health-card" href="/admin/ads">
            <span>Ads awaiting approval</span>
            <strong className={pendingAds.length > 0 ? 'admin-health-status warn' : 'admin-health-status ok'}>{pendingAds.length}</strong>
          </Link>
        </div>
        {healthOperations && healthOperations.reservedTicketOrders > 0 && (
          <div className="admin-alert-row">
            <span>{healthOperations.reservedTicketOrders} ticket order{healthOperations.reservedTicketOrders === 1 ? '' : 's'} reserved (unpaid) — check Finance if this stays high</span>
          </div>
        )}
        {pendingVerificationCount === 0 && openReportCount === 0 && openSupportCount === 0 && pendingAds.length === 0 && (
          <div className="admin-alert-row admin-alert-row-ok">
            <span>Nothing needs review right now.</span>
          </div>
        )}
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
                  <FeatureToggle showId={show.id} initialFeatured={show.featured} />
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

        <article className="panel admin-console-panel" id="support-requests">
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

      <section className="panel admin-console-panel">
        <div className="admin-console-panel-head">
          <div>
            <h2>Security</h2>
            <p className="meta">Spam flags and login activity in the last 24 hours.</p>
          </div>
        </div>
        <div className="admin-metric-grid" style={{ marginBottom: '1rem' }}>
          <article className="card admin-metric-card">
            <span>Spam flags (24h)</span>
            <strong>{recentSpamFlags.length}</strong>
          </article>
          <article className="card admin-metric-card">
            <span>Logins (24h)</span>
            <strong>{recentLoginsCount}</strong>
          </article>
        </div>
        {recentSpamFlags.length > 0 && (
          <div className="admin-list">
            {recentSpamFlags.map((flag) => (
              <div className="admin-list-row" key={flag.id}>
                <span>{flag.body}</span>
                <small>{flag.user?.username ?? flag.user?.email ?? flag.userId} | {flag.createdAt.toISOString()}</small>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Artist Funnel */}
      <section className="panel admin-console-panel">
        <div className="admin-console-panel-head">
          <div>
            <h2>Artist Funnel</h2>
            <p className="meta">Where artists drop off before their first show.</p>
          </div>
        </div>
        <div className="admin-health-grid">
          <div className="admin-health-card">
            <span>No uploads yet</span>
            <strong style={{ color: funnelStage1 > 0 ? '#e74c3c' : 'inherit' }}>{funnelStage1}</strong>
          </div>
          <div className="admin-health-card">
            <span>Uploads, no shows</span>
            <strong style={{ color: funnelStage2 > 0 ? '#f39c12' : 'inherit' }}>{funnelStage2}</strong>
          </div>
          <div className="admin-health-card">
            <span>Shows with 0 hypes</span>
            <strong>{funnelStage3}</strong>
          </div>
        </div>
        {funnelStage1Recent.length > 0 && (
          <div className="admin-list" style={{ marginTop: 12 }}>
            <strong style={{ fontSize: 13, marginBottom: 6, display: 'block' }}>Recent stage-1 artists (no uploads)</strong>
            {funnelStage1Recent.map((p) => (
              <div className="admin-list-row" key={p.slug}>
                <span>{p.name}</span>
                <small>{p.slug} · joined {p.createdAt.toISOString().slice(0, 10)}</small>
              </div>
            ))}
          </div>
        )}
        <BulkActions
          items={funnelStage1Recent.map((p) => ({ id: p.slug, label: p.name }))}
          type="profiles"
        />
      </section>

      {/* Social Posts */}
      <section className="panel admin-console-panel">
        <div className="admin-console-panel-head">
          <div>
            <h2>Social Posts</h2>
            <p className="meta">Recent auto-generated social digest posts.</p>
          </div>
        </div>
        {recentSocialPosts.length === 0 ? (
          <div className="empty">No social posts yet. Monday digest will generate them.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {recentSocialPosts.map((post) => (
              <div key={post.id} style={{ background: 'var(--bg2,#111)', border: '1px solid var(--line2,#333)', borderRadius: 8, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <pre style={{ fontFamily: 'inherit', fontSize: 13, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{post.text}</pre>
                  <small style={{ color: 'var(--ink3,#666)', fontSize: 11 }}>{post.generatedAt.toISOString().slice(0, 16)}</small>
                </div>
                <SocialPostCopy text={post.text} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Content Calendar */}
      <section className="panel admin-console-panel">
        <div className="admin-console-panel-head">
          <div>
            <h2>Upcoming Calendar</h2>
            <p className="meta">Scheduled shows in the next 30 days.</p>
          </div>
        </div>
        {calendarShows.length === 0 ? (
          <div className="empty">No scheduled shows in the next 30 days.</div>
        ) : (
          <div>
            {Object.entries(
              calendarShows.reduce((acc: Record<string, typeof calendarShows>, show) => {
                const date = show.startsAt.toLocaleDateString();
                acc[date] ??= [];
                acc[date].push(show);
                return acc;
              }, {})
            ).map(([date, shows]) => (
              <div key={date} style={{ marginBottom: 14 }}>
                <div style={{ fontFamily: 'var(--f-mono,monospace)', fontSize: 12, fontWeight: 700, color: 'var(--ink3,#666)', marginBottom: 6, letterSpacing: '.08em', textTransform: 'uppercase' }}>{date}</div>
                {shows.map((show) => (
                  <div key={show.id} className="admin-list-row" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ flex: 1 }}>{show.title}</span>
                    <small>{show.venueProfile?.name ?? '—'}</small>
                    <small>{show.headlinerProfile?.name ?? '—'}</small>
                    <small>{show.ticketsSoldCount}/{show.ticketCapacity ?? '∞'} tix</small>
                    <FeatureToggle showId={show.id} initialFeatured={show.featured} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="section">
        <h2>Invite Codes</h2>
        <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <a className="button" href="/api/admin/invite-codes" target="_blank" rel="noopener noreferrer" style={{ fontSize: 13 }}>
            View all via API
          </a>
          <a className="button" href="/api/admin/test-email" target="_blank" rel="noopener noreferrer" style={{ fontSize: 13 }}>
            Send test email
          </a>
        </div>
        {recentInviteCodes.length === 0 ? (
          <p className="meta">No invite codes yet. POST to /api/admin/invite-codes to generate some.</p>
        ) : (
          <div className="admin-list">
            {recentInviteCodes.map((code) => (
              <div className="admin-list-row" key={code.id}>
                <code style={{ fontFamily: 'monospace', letterSpacing: 1 }}>{code.code}</code>
                <small>
                  {code.usedAt ? `Used ${code.usedAt.toISOString()}` : code.expiresAt && code.expiresAt < new Date() ? 'Expired' : 'Available'}
                  {' | '}created {code.createdAt.toISOString()}
                </small>
              </div>
            ))}
          </div>
        )}
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
              <strong>Supabase:</strong>{' '}
              <a href="https://supabase.com/dashboard" rel="noopener noreferrer" target="_blank">
                supabase.com/dashboard
              </a>{' '}
              — branch the production database for point-in-time snapshots.
            </li>
            <li>
              <strong>Cloudflare:</strong>{' '}
              <a href="https://dash.cloudflare.com/" rel="noopener noreferrer" target="_blank">
                dash.cloudflare.com
              </a>{' '}
              — review Workers logs, R2 storage, and analytics.
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

      {/* ── Revenue Dashboard ──────────────────────────────────── */}
      <section className="section">
        <h2>Revenue</h2>
        <div className="admin-list" style={{ marginBottom: 16 }}>
          <div className="admin-list-row"><strong>Total ticket revenue (CAPTURED)</strong><span>{`$${(revenueCents / 100).toFixed(2)}`}</span></div>
          <div className="admin-list-row"><strong>Platform fee est. (10%)</strong><span>{`$${(platformFeeTotal / 100).toFixed(2)}`}</span></div>
          <div className="admin-list-row"><strong>Payouts paid</strong><span>{`$${(payoutPaid / 100).toFixed(2)}`}</span></div>
          <div className="admin-list-row"><strong>Payouts pending</strong><span>{`$${(payoutPending / 100).toFixed(2)}`}</span></div>
        </div>
        {monthlyRows.length > 0 && (
          <>
            <h3 style={{ fontSize: 14, marginBottom: 8 }}>Monthly revenue (last 12 months)</h3>
            <div className="admin-list">
              {monthlyRows.map(([month, cents]) => (
                <div className="admin-list-row" key={month}>
                  <span>{month}</span>
                  <strong>{`$${(cents / 100).toFixed(2)}`}</strong>
                </div>
              ))}
            </div>
          </>
        )}
        {topEarners.length > 0 && (
          <>
            <h3 style={{ fontSize: 14, marginBottom: 8, marginTop: 16 }}>Top earners (by profile)</h3>
            <div className="admin-list">
              {topEarners.map((e) => (
                <div className="admin-list-row" key={e.profileId}>
                  <span>{e.profileId ?? 'unknown'}</span>
                  <strong>{`$${((e._sum.amountCents ?? 0) / 100).toFixed(2)}`}</strong>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* ── Rate Limits ───────────────────────────────────────── */}
      <section className="section">
        <h2>Rate Limits (last 24h)</h2>
        {recentSpamFlags.length === 0 ? (
          <p className="meta">No SPAM_FLAG notifications in the last 24 hours.</p>
        ) : (
          <div className="admin-list">
            {recentSpamFlags.map((n) => (
              <div className="admin-list-row" key={n.id}>
                <span>{n.user?.username ?? n.user?.email ?? n.userId}</span>
                <small>{n.body}</small>
                <small>{n.createdAt.toISOString().slice(0, 16)}</small>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── A/B Tests ─────────────────────────────────────────── */}
      <section className="section">
        <h2>A/B Tests</h2>
        {abTests.length === 0 ? (
          <p className="meta">No A/B tests configured. POST to /api/admin/ab-tests to create one.</p>
        ) : (
          <div className="admin-list">
            {abTests.map((t) => (
              <div className="admin-list-row" key={t.key}>
                <code>{t.key}</code>
                <span>{t.description ?? '—'}</span>
                <strong style={{ color: t.enabled ? 'var(--teal, #22e5d4)' : 'var(--ink3, #666)' }}>{t.enabled ? 'ENABLED' : 'DISABLED'}</strong>
                <small>{t.createdAt.toISOString().slice(0, 10)}</small>
              </div>
            ))}
          </div>
        )}
        <p className="meta" style={{ marginTop: 8 }}>
          Manage via <code>POST /api/admin/ab-tests</code> with <code>{`{key, description, enabled}`}</code>.
        </p>
      </section>

      {/* ── Ads ───────────────────────────────────────────────── */}
      <section className="section">
        <h2>Ads — Pending Review</h2>
        {pendingAds.length === 0 ? (
          <p className="meta">No pending ads.</p>
        ) : (
          <div className="admin-list">
            {pendingAds.map((ad) => (
              <div className="admin-list-row" key={ad.id} style={{ flexWrap: 'wrap', gap: 8 }}>
                <strong>{ad.title}</strong>
                <span>{ad.slot?.name}</span>
                <small>{ad.advertiser?.username ?? ad.advertiser?.email}</small>
                <small>{ad.createdAt.toISOString().slice(0, 10)}</small>
                <div style={{ display: 'flex', gap: 6 }}>
                  <form method="POST" action={`/api/admin/ads/${ad.id}`} style={{ display: 'inline' }}>
                    <input type="hidden" name="status" value="APPROVED" />
                    <button type="submit" className="button small" style={{ fontSize: 12 }}>Approve</button>
                  </form>
                  <form method="POST" action={`/api/admin/ads/${ad.id}`} style={{ display: 'inline' }}>
                    <input type="hidden" name="status" value="REJECTED" />
                    <button type="submit" className="button small secondary" style={{ fontSize: 12 }}>Reject</button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="meta" style={{ marginTop: 8 }}>
          Manage via <code>PATCH /api/admin/ads/[adId]</code> with <code>{`{status: "APPROVED"|"REJECTED"}`}</code>.
        </p>
      </section>
    </main>
  );
}

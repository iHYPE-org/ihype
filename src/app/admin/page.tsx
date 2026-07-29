import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminSignupTestPanel } from '@/components/AdminSignupTestPanel';
import { redirect } from 'next/navigation';
import { AdminReportActions, AdminVerificationActions } from '@/components/AdminModerationActions';
import { AdminPrivacyRequestActions } from '@/components/AdminPrivacyRequestActions';
import { AdminFeatureFlags } from '@/components/AdminFeatureFlags';
import { FeatureToggle } from '@/components/admin/FeatureToggle';
import { BulkActions } from '@/components/admin/BulkActions';
import { SocialPostCopy } from '@/components/admin/SocialPostCopy';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getBetaMetrics } from '@/lib/beta-metrics';
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
import { getServerT } from '@/lib/i18n/server';


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

  const t = await getServerT();
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
  const betaMetrics = await getBetaMetrics().catch(() => null);
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
    <div className="container section admin-console">
      <section className="panel admin-console-hero">
        <div>
          <div className="badge">{t('adminPage.betaBadge', 'Admin beta console')}</div>
          <h1>{t('adminPage.title', 'Admin Console')}</h1>
          <p className="subtitle">
            {t('adminPage.subtitle', 'Platform management · iH/OPS — account growth, verification, email/MFA delivery, reports, tickets, media, and audit events during beta.')}
          </p>
        </div>
        <div className="cta-row">
          <Link className="button" href="/admin/users">
            {t('adminPage.userManagement', 'User management')}
          </Link>
          <Link className="button" href="/admin/broadcast">
            {t('adminPage.broadcastEmail', 'Broadcast email')}
          </Link>
          <Link className="button secondary" href="/admin/community">
            {t('adminPage.communityEditor', 'Community editor')}
          </Link>
          <Link className="button secondary" href="/info?tab=transparency">
            {t('adminPage.transparency', 'Transparency')}
          </Link>
        </div>
      </section>

      <section className="panel admin-console-panel">
        <div className="admin-console-panel-head">
          <h2>{t('adminPage.needsAttention', 'Needs attention')}</h2>
        </div>
        <div className="admin-health-grid">
          <Link className="admin-health-card" href="/admin/review?tab=verifications">
            <span>{t('adminPage.pendingVerifications', 'Pending verifications')}</span>
            <strong className={pendingVerificationCount > 0 ? 'admin-health-status warn' : 'admin-health-status ok'}>{pendingVerificationCount}</strong>
          </Link>
          <Link className="admin-health-card" href="/admin/review?tab=reports">
            <span>{t('adminPage.openReports', 'Open reports')}</span>
            <strong className={openReportCount > 0 ? 'admin-health-status warn' : 'admin-health-status ok'}>{openReportCount}</strong>
          </Link>
          <Link className="admin-health-card" href="/admin#support-requests">
            <span>{t('adminPage.openSupportRequests', 'Open support requests')}</span>
            <strong className={openSupportCount > 0 ? 'admin-health-status warn' : 'admin-health-status ok'}>{openSupportCount}</strong>
          </Link>
          <Link className="admin-health-card" href="/admin/ads">
            <span>{t('adminPage.adsAwaitingApproval', 'Ads awaiting approval')}</span>
            <strong className={pendingAds.length > 0 ? 'admin-health-status warn' : 'admin-health-status ok'}>{pendingAds.length}</strong>
          </Link>
        </div>
        {healthOperations && healthOperations.reservedTicketOrders > 0 && (
          <div className="admin-alert-row">
            <span>{healthOperations.reservedTicketOrders} {healthOperations.reservedTicketOrders === 1 ? t('adminPage.ticketOrderSingular', 'ticket order') : t('adminPage.ticketOrderPlural', 'ticket orders')} {t('adminPage.reservedUnpaidWarning', 'reserved (unpaid) — check Finance if this stays high')}</span>
          </div>
        )}
        {pendingVerificationCount === 0 && openReportCount === 0 && openSupportCount === 0 && pendingAds.length === 0 && (
          <div className="admin-alert-row admin-alert-row-ok">
            <span>{t('adminPage.nothingNeedsReview', 'Nothing needs review right now.')}</span>
          </div>
        )}
      </section>

      <section className="panel admin-console-panel">
        <div className="admin-console-panel-head">
          <div>
            <h2>{t('adminPage.userSearch', 'User search')}</h2>
            <p className="meta">{t('adminPage.userSearchDesc', 'Search by email or username.')}</p>
          </div>
        </div>
        <form method="GET" style={{ display: 'flex', gap: 8, marginBottom: userSearchResults.length ? 16 : 0 }}>
          <input
            name="userSearch"
            defaultValue={userSearch ?? ''}
            placeholder={t('adminPage.userSearchPlaceholder', 'Email or username…')}
            style={{ flex: 1, padding: '8px 12px', borderRadius: 7, border: '1px solid var(--line2, #333)', background: 'var(--bg2, #111)', color: 'inherit', fontSize: 14 }}
          />
          <button type="submit" className="button small secondary">{t('adminPage.search', 'Search')}</button>
          {userSearch && <Link className="button small secondary" href="/admin">{t('adminPage.clear', 'Clear')}</Link>}
        </form>
        {userSearchResults.length > 0 && (
          <div className="admin-list">
            {userSearchResults.map(u => (
              <div className="admin-list-row" key={u.id}>
                <span>{u.username ?? u.email}</span>
                <strong>{u.role}</strong>
                <small>{u.email}</small>
                <small>{u.profiles.map(p => p.type).join(', ') || t('adminPage.noProfiles', 'no profiles')}</small>
                <small>{u.createdAt.toISOString().slice(0, 10)}</small>
              </div>
            ))}
          </div>
        )}
        {userSearch && userSearchResults.length === 0 && (
          <div className="empty">{t('adminPage.noUsersFound', 'No users found for')} &ldquo;{userSearch}&rdquo;.</div>
        )}
      </section>

      <section className="admin-metric-grid">
        <article className="card admin-metric-card">
          <span>{t('adminPage.revenueCaptured', 'Revenue (captured)')}</span>
          <strong>{revenueLabel}</strong>
        </article>
      </section>

      <section className="admin-metric-grid">
        {[
          [t('adminPage.metricUsers', 'Users'), userCount],
          [t('adminPage.metricProfiles', 'Profiles'), profileCount],
          [t('adminPage.metricPendingVerification', 'Pending verification'), pendingVerificationCount],
          [t('adminPage.metricOpenReports', 'Open reports'), openReportCount],
          [t('adminPage.metricSupportRequests', 'Support requests'), openSupportCount],
          [t('adminPage.metricMediaAssets', 'Media assets'), mediaCount],
          [t('adminPage.metricTicketOrders', 'Ticket orders'), ticketOrderCount]
        ].map(([label, value]) => (
          <article className="card admin-metric-card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>

      <section className="panel admin-console-panel admin-health-panel">
        <div className="admin-console-panel-head">
          <div>
            <h2>{t('adminPage.launchHealth', 'Launch health')}</h2>
            <p className="meta">
              {t('adminPage.publicUptimeEndpoint', 'Public uptime endpoint:')} <Link className="text-link" href="/api/health">/api/health</Link>
            </p>
          </div>
          <strong className={health.status === 'ok' ? 'admin-health-status ok' : 'admin-health-status warn'}>
            {health.status}
          </strong>
        </div>
        <div className="admin-health-grid">
          <div className="admin-health-card">
            <span>{t('adminPage.dbLatency', 'DB latency')}</span>
            <strong>{health.latencyMs}ms</strong>
          </div>
          <div className="admin-health-card">
            <span>{t('adminPage.failedEmail24h', 'Failed email 24h')}</span>
            <strong>{healthOperations ? healthOperations.failedEmails24h : t('adminPage.notApplicable', 'n/a')}</strong>
          </div>
          <div className="admin-health-card">
            <span>{t('adminPage.reservedTickets', 'Reserved tickets')}</span>
            <strong>{healthOperations ? healthOperations.reservedTicketOrders : t('adminPage.notApplicable2', 'n/a')}</strong>
          </div>
          <div className="admin-health-card">
            <span>{t('adminPage.paymentCapture', 'Payment capture')}</span>
            <strong>{healthIntegrations?.ticketPaymentCapture ? t('adminPage.ready', 'Ready') : t('adminPage.blocked', 'Blocked')}</strong>
          </div>
        </div>
      </section>

      {betaMetrics && (
        <section className="panel admin-console-panel">
          <div className="admin-console-panel-head">
            <div>
              <h2>{t('adminPage.betaMetrics', 'Beta metrics')}</h2>
              <p className="meta">
                {t('adminPage.betaMetricsDesc', "Real activity only — activation means the user has hyped, RSVP'd, or listened at least once. Demo accounts excluded.")}
              </p>
            </div>
          </div>
          <div className="admin-health-grid">
            <div className="admin-health-card">
              <span>{t('adminPage.signups7d', 'Signups (7d)')}</span>
              <strong>{betaMetrics.signups7d}</strong>
            </div>
            <div className="admin-health-card">
              <span>{t('adminPage.activation', 'Activation')}</span>
              <strong>
                {Math.round(betaMetrics.activationRate * 100)}%
                {' '}({betaMetrics.activatedUsers}/{betaMetrics.totalUsers})
              </strong>
            </div>
            <div className="admin-health-card">
              <span>{t('adminPage.weeklyActive', 'Weekly active')}</span>
              <strong>
                {Math.round(betaMetrics.weeklyActiveRate * 100)}%
                {' '}({betaMetrics.weeklyActiveUsers}/{betaMetrics.totalUsers})
              </strong>
            </div>
            <div className="admin-health-card">
              <span>{t('adminPage.djsOnRadio30d', 'DJs on radio (30d)')}</span>
              <strong>{betaMetrics.recurringDjs30d}/{betaMetrics.radioDjs30d} {t('adminPage.recurring', 'recurring')}</strong>
            </div>
          </div>
          <h3 style={{ margin: '1rem 0 .5rem' }}>{t('adminPage.inviteConversion30d', 'Invite conversion (30d)')}</h3>
          {betaMetrics.inviteChannels.length === 0 ? (
            <p className="meta">{t('adminPage.noSignups30d', 'No signups recorded in the last 30 days.')}</p>
          ) : (
            <div className="admin-list">
              {betaMetrics.inviteChannels.map((channel) => (
                <div className="admin-list-row" key={channel.code}>
                  <code style={{ fontFamily: 'monospace', letterSpacing: 1 }}>{channel.code}</code>
                  <small>
                    {channel.signups} {channel.signups === 1 ? t('adminPage.signupSingular', 'signup') : t('adminPage.signupPlural', 'signups')}
                    {channel.kind !== '—' ? ` | ${channel.kind}` : ''}
                  </small>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="panel admin-console-panel">
        <div className="admin-console-panel-head">
          <div>
            <h2>{t('adminPage.signupFunnel', 'Signup funnel')}</h2>
            <p className="meta">{t('adminPage.signupFunnelDesc', 'Last 7 days from audit events. Use this to spot passkey/email dropoff.')}</p>
          </div>
          <div className="admin-signup-actions">
            <AdminSignupTestPanel />
            <Link className="button small secondary" href="/for-artists">
              {t('adminPage.testSignupUi', 'Test signup UI')}
            </Link>
          </div>
        </div>
        {funnelAlerts.length ? (
          <div className="admin-alert-row">
            {funnelAlerts.map((alert) => <span key={alert}>{alert}</span>)}
          </div>
        ) : (
          <div className="admin-alert-row admin-alert-row-ok"><span>{t('adminPage.noSignupAlerts', 'No signup alerts in the 7d funnel window.')}</span></div>
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
          <strong>{t('adminPage.passkeyDiagnostics', 'Passkey diagnostics')}</strong>
          {passkeyDiagnostics.length ? passkeyDiagnostics.map(({ action, meta }, index) => (
            <div className="admin-diagnostic-row" key={`${action}-${index}`}>
              <span>{action}</span>
              <small>{metaText(meta, 'browser')} / {metaText(meta, 'platform')} / {metaText(meta, 'webauthn')} / {metaText(meta, 'errorName')}</small>
              <em>{metaText(meta, 'reason')}</em>
            </div>
          )) : <p className="meta">{t('adminPage.noPasskeyFailures', 'No recent passkey failures captured.')}</p>}
        </div>
      </section>

      <section className="panel admin-console-panel">
        <div className="admin-console-panel-head">
          <div>
            <h2>{t('adminPage.rateLimitHits1h', 'Rate limit hits (1h)')}</h2>
            <p className="meta">{t('adminPage.rateLimitHitsDesc', 'Top buckets that returned 429 in the last hour.')}</p>
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
            <div className="empty">{t('adminPage.noRateLimitHits', 'No rate limit hits in the last hour.')}</div>
          )}
        </div>
      </section>

      <section className="grid grid-2 admin-console-grid">
        <article className="panel admin-console-panel">
          <h2>{t('adminPage.featureFlags', 'Feature flags')}</h2>
          <div className="admin-export-row" aria-label={t('adminPage.adminCsvExportsAriaLabel', 'Admin CSV exports')}>
            {(['reports', 'support', 'verifications', 'tickets', 'audits'] as const).map((kind) => (
              <Link className="button small secondary" href={`/api/admin/export/${kind}`} key={kind}>
                {t('adminPage.export', 'Export')} {kind}
              </Link>
            ))}
          </div>
          <AdminFeatureFlags initialFlags={featureFlags} />
        </article>

        <article className="panel admin-console-panel">
          <h2>{t('adminPage.ticketOrders', 'Ticket orders')}</h2>
          <div className="admin-list">
            {recentTicketOrders.length ? (
              recentTicketOrders.map((order) => (
                <div className="admin-list-row" key={order.id}>
                  <span>{order.show?.title ?? t('adminPage.unknownShow', 'Unknown show')}</span>
                  <strong>{order.status}</strong>
                  <small>{order.buyerEmail} · ${(order.totalChargeCents / 100).toFixed(2)}</small>
                </div>
              ))
            ) : (
              <div className="empty">{t('adminPage.noTicketOrders', 'No ticket orders yet.')}</div>
            )}
          </div>
        </article>

        <article className="panel admin-console-panel">
          <h2>{t('adminPage.recentShows', 'Recent shows')}</h2>
          <div className="admin-list">
            {recentShows.length ? (
              recentShows.map((show) => (
                <div className="admin-list-row" key={show.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ flex: 1 }}>{show.title}</span>
                  <small>{show.venueProfile?.name ?? '—'}</small>
                  <small>{show.startsAt.toISOString().slice(0, 10)}</small>
                  <small>{show._count.tickets} {t('adminPage.tix', 'tix')}</small>
                  <FeatureToggle showId={show.id} initialFeatured={show.featured} />
                </div>
              ))
            ) : (
              <div className="empty">{t('adminPage.noShowsYet', 'No shows yet.')}</div>
            )}
          </div>
        </article>

        <article className="panel admin-console-panel">
          <h2>{t('adminPage.recentUsers', 'Recent users')}</h2>
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
          <h2>{t('adminPage.contentReports', 'Content reports')}</h2>
          <div className="admin-list">
            {recentReports.length ? (
              recentReports.map((report) => (
                <div className="admin-list-row" key={report.id}>
                  <span>{report.reason}</span>
                  <strong>{report.status}</strong>
                  <small>
                    {report.targetType}:{report.targetId} {t('adminPage.by', 'by')} {report.reporter?.username ?? report.reporter?.email ?? t('adminPage.unknown', 'unknown')}
                  </small>
                  <AdminReportActions reportId={report.id} />
                </div>
              ))
            ) : (
              <div className="empty">{t('adminPage.noReportsYet', 'No reports yet.')}</div>
            )}
          </div>
        </article>

        <article className="panel admin-console-panel" id="support-requests">
          <h2>{t('adminPage.supportRequests', 'Support requests')}</h2>
          <div className="admin-list">
            {recentSupport.length ? (
              recentSupport.map((request) => (
                <div className="admin-list-row" key={request.id}>
                  <span>{request.subject}</span>
                  <strong>{request.priority}</strong>
                  <small>
                    {request.type} | {request.status} | {request.email ?? request.name ?? t('adminPage.anonymous', 'anonymous')}
                  </small>
                  {request.type.startsWith('PRIVACY_') && request.status === 'OPEN' ? (
                    <AdminPrivacyRequestActions requestId={request.id} requestType={request.type} />
                  ) : null}
                </div>
              ))
            ) : (
              <div className="empty">{t('adminPage.noSupportRequestsYet', 'No support requests yet.')}</div>
            )}
          </div>
        </article>

        <article className="panel admin-console-panel">
          <h2>{t('adminPage.verificationQueue', 'Verification queue')}</h2>
          <div className="admin-list">
            {pendingVerifications.length ? (
              pendingVerifications.map((profile) => (
                <div className="admin-list-row" key={profile.id}>
                  <span>{profile.name}</span>
                  <strong>{profile.type === 'DJ' ? 'PROMOTER' : profile.type}</strong>
                  <small>{profile.contactInfo || profile.verificationNotes || t('adminPage.noDetailsProvided', 'No details provided')}</small>
                  <AdminVerificationActions profileId={profile.id} />
                </div>
              ))
            ) : (
              <div className="empty">{t('adminPage.noPendingVerificationRequests', 'No pending verification requests.')}</div>
            )}
          </div>
        </article>

        <article className="panel admin-console-panel">
          <h2>{t('adminPage.emailMfaDelivery', 'Email/MFA delivery')}</h2>
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
              <div className="empty">{t('adminPage.noEmailDeliveryRecordsYet', 'No email delivery records yet.')}</div>
            )}
          </div>
        </article>

        <article className="panel admin-console-panel admin-console-panel-wide">
          <h2>{t('adminPage.auditLog', 'Audit log')}</h2>
          <div className="admin-list">
            {recentAudits.length ? (
              recentAudits.map((audit) => (
                <div className="admin-list-row" key={audit.id}>
                  <span>{audit.action}</span>
                  <strong>{audit.entityType}</strong>
                  <small>{audit.actor?.username ?? audit.actor?.email ?? t('adminPage.system', 'system')} | {audit.entityId ?? t('adminPage.noId', 'no id')}</small>
                </div>
              ))
            ) : (
              <div className="empty">{t('adminPage.noAuditEventsYet', 'No audit events yet.')}</div>
            )}
          </div>
        </article>
      </section>

      <section className="panel admin-console-panel">
        <div className="admin-console-panel-head">
          <div>
            <h2>{t('adminPage.security', 'Security')}</h2>
            <p className="meta">{t('adminPage.securityDesc', 'Spam flags and login activity in the last 24 hours.')}</p>
          </div>
        </div>
        <div className="admin-metric-grid" style={{ marginBottom: '1rem' }}>
          <article className="card admin-metric-card">
            <span>{t('adminPage.spamFlags24h', 'Spam flags (24h)')}</span>
            <strong>{recentSpamFlags.length}</strong>
          </article>
          <article className="card admin-metric-card">
            <span>{t('adminPage.logins24h', 'Logins (24h)')}</span>
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
            <h2>{t('adminPage.artistFunnel', 'Artist Funnel')}</h2>
            <p className="meta">{t('adminPage.artistFunnelDesc', 'Where artists drop off before their first show.')}</p>
          </div>
        </div>
        <div className="admin-health-grid">
          <div className="admin-health-card">
            <span>{t('adminPage.noUploadsYet', 'No uploads yet')}</span>
            <strong style={{ color: funnelStage1 > 0 ? '#e74c3c' : 'inherit' }}>{funnelStage1}</strong>
          </div>
          <div className="admin-health-card">
            <span>{t('adminPage.uploadsNoShows', 'Uploads, no shows')}</span>
            <strong style={{ color: funnelStage2 > 0 ? '#f39c12' : 'inherit' }}>{funnelStage2}</strong>
          </div>
          <div className="admin-health-card">
            <span>{t('adminPage.showsWithZeroHypes', 'Shows with 0 hypes')}</span>
            <strong>{funnelStage3}</strong>
          </div>
        </div>
        {funnelStage1Recent.length > 0 && (
          <div className="admin-list" style={{ marginTop: 12 }}>
            <strong style={{ fontSize: 13, marginBottom: 6, display: 'block' }}>{t('adminPage.recentStage1Artists', 'Recent stage-1 artists (no uploads)')}</strong>
            {funnelStage1Recent.map((p) => (
              <div className="admin-list-row" key={p.slug}>
                <span>{p.name}</span>
                <small>{p.slug} · {t('adminPage.joined', 'joined')} {p.createdAt.toISOString().slice(0, 10)}</small>
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
            <h2>{t('adminPage.socialPosts', 'Social Posts')}</h2>
            <p className="meta">{t('adminPage.socialPostsDesc', 'Recent auto-generated social digest posts.')}</p>
          </div>
        </div>
        {recentSocialPosts.length === 0 ? (
          <div className="empty">{t('adminPage.noSocialPostsYet', 'No social posts yet. Monday digest will generate them.')}</div>
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
            <h2>{t('adminPage.upcomingCalendar', 'Upcoming Calendar')}</h2>
            <p className="meta">{t('adminPage.upcomingCalendarDesc', 'Scheduled shows in the next 30 days.')}</p>
          </div>
        </div>
        {calendarShows.length === 0 ? (
          <div className="empty">{t('adminPage.noScheduledShows30d', 'No scheduled shows in the next 30 days.')}</div>
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
                    <small>{show.ticketsSoldCount}/{show.ticketCapacity ?? '∞'} {t('adminPage.tix2', 'tix')}</small>
                    <FeatureToggle showId={show.id} initialFeatured={show.featured} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="section">
        <h2>{t('adminPage.inviteCodes', 'Invite Codes')}</h2>
        <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <a className="button" href="/api/admin/invite-codes" target="_blank" rel="noopener noreferrer" style={{ fontSize: 13 }}>
            {t('adminPage.viewAllViaApi', 'View all via API')}
          </a>
          <a className="button" href="/api/admin/test-email" target="_blank" rel="noopener noreferrer" style={{ fontSize: 13 }}>
            {t('adminPage.sendTestEmail', 'Send test email')}
          </a>
        </div>
        {recentInviteCodes.length === 0 ? (
          <p className="meta">{t('adminPage.noInviteCodesYet', 'No invite codes yet. POST to /api/admin/invite-codes to generate some.')}</p>
        ) : (
          <div className="admin-list">
            {recentInviteCodes.map((code) => (
              <div className="admin-list-row" key={code.id}>
                <code style={{ fontFamily: 'monospace', letterSpacing: 1 }}>{code.code}</code>
                <small>
                  {code.usedAt ? `${t('adminPage.used', 'Used')} ${code.usedAt.toISOString()}` : code.expiresAt && code.expiresAt < new Date() ? t('adminPage.expired', 'Expired') : t('adminPage.available', 'Available')}
                  {' | '}{t('adminPage.created', 'created')} {code.createdAt.toISOString()}
                </small>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="section">
        <h2>{t('adminPage.backups', 'Backups')}</h2>
        <article className="panel" style={{ padding: '1rem 1.25rem' }}>
          <p className="meta" style={{ marginTop: 0 }}>
            {t('adminPage.backupsDesc', 'iHYPE does not currently run an automated database backup job. Postgres backups should be taken from the managed provider dashboard on a regular cadence (daily for production).')}
          </p>
          <ul style={{ paddingLeft: '1.2rem', margin: '0.5rem 0', lineHeight: 1.6 }}>
            <li>
              <strong>{t('adminPage.supabaseLabel', 'Supabase:')}</strong>{' '}
              <a href="https://supabase.com/dashboard" rel="noopener noreferrer" target="_blank">
                supabase.com/dashboard
              </a>{' '}
              — {t('adminPage.supabaseDesc', 'branch the production database for point-in-time snapshots.')}
            </li>
            <li>
              <strong>{t('adminPage.cloudflareLabel', 'Cloudflare:')}</strong>{' '}
              <a href="https://dash.cloudflare.com/" rel="noopener noreferrer" target="_blank">
                dash.cloudflare.com
              </a>{' '}
              — {t('adminPage.cloudflareDesc', 'review Workers logs, R2 storage, and analytics.')}
            </li>
            <li>
              {t('adminPage.adHocExports', 'For ad-hoc exports run')} <code>pg_dump &quot;$DATABASE_URL&quot; &gt; ihype-backup.sql</code>{' '}
              {t('adminPage.fromTrustedWorkstation', 'from a trusted workstation.')}
            </li>
          </ul>
          <p className="meta" style={{ marginBottom: 0 }}>
            {t('adminPage.backupsNote', 'Note: an R2/S3-backed automated rotation job is planned but intentionally not wired up yet — this section is informational so admins know where to look.')}
          </p>
        </article>
      </section>

      {/* ── Revenue Dashboard ──────────────────────────────────── */}
      <section className="section">
        <h2>{t('adminPage.revenue', 'Revenue')}</h2>
        <div className="admin-list" style={{ marginBottom: 16 }}>
          <div className="admin-list-row"><strong>{t('adminPage.totalTicketRevenue', 'Total ticket revenue (CAPTURED)')}</strong><span>{`$${(revenueCents / 100).toFixed(2)}`}</span></div>
          <div className="admin-list-row"><strong>{t('adminPage.platformFeeEst', 'Platform fee est. (10%)')}</strong><span>{`$${(platformFeeTotal / 100).toFixed(2)}`}</span></div>
          <div className="admin-list-row"><strong>{t('adminPage.payoutsPaid', 'Payouts paid')}</strong><span>{`$${(payoutPaid / 100).toFixed(2)}`}</span></div>
          <div className="admin-list-row"><strong>{t('adminPage.payoutsPending', 'Payouts pending')}</strong><span>{`$${(payoutPending / 100).toFixed(2)}`}</span></div>
        </div>
        {monthlyRows.length > 0 && (
          <>
            <h3 style={{ fontSize: 14, marginBottom: 8 }}>{t('adminPage.monthlyRevenue12mo', 'Monthly revenue (last 12 months)')}</h3>
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
            <h3 style={{ fontSize: 14, marginBottom: 8, marginTop: 16 }}>{t('adminPage.topEarnersByProfile', 'Top earners (by profile)')}</h3>
            <div className="admin-list">
              {topEarners.map((e) => (
                <div className="admin-list-row" key={e.profileId}>
                  <span>{e.profileId ?? t('adminPage.unknown2', 'unknown')}</span>
                  <strong>{`$${((e._sum.amountCents ?? 0) / 100).toFixed(2)}`}</strong>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* ── Rate Limits ───────────────────────────────────────── */}
      <section className="section">
        <h2>{t('adminPage.rateLimitsLast24h', 'Rate Limits (last 24h)')}</h2>
        {recentSpamFlags.length === 0 ? (
          <p className="meta">{t('adminPage.noSpamFlagNotifications', 'No SPAM_FLAG notifications in the last 24 hours.')}</p>
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
        <h2>{t('adminPage.abTests', 'A/B Tests')}</h2>
        {abTests.length === 0 ? (
          <p className="meta">{t('adminPage.noAbTestsConfigured', 'No A/B tests configured. POST to /api/admin/ab-tests to create one.')}</p>
        ) : (
          <div className="admin-list">
            {abTests.map((test) => (
              <div className="admin-list-row" key={test.key}>
                <code>{test.key}</code>
                <span>{test.description ?? '—'}</span>
                <strong style={{ color: test.enabled ? 'var(--teal, #22e5d4)' : 'var(--ink3, #666)' }}>{test.enabled ? t('adminPage.enabled', 'ENABLED') : t('adminPage.disabled', 'DISABLED')}</strong>
                <small>{test.createdAt.toISOString().slice(0, 10)}</small>
              </div>
            ))}
          </div>
        )}
        <p className="meta" style={{ marginTop: 8 }}>
          {t('adminPage.manageViaAbTests', 'Manage via')} <code>POST /api/admin/ab-tests</code> {t('adminPage.withParams', 'with')} <code>{`{key, description, enabled}`}</code>.
        </p>
      </section>

      {/* ── Ads ───────────────────────────────────────────────── */}
      <section className="section">
        <h2>{t('adminPage.adsPendingReview', 'Ads — Pending Review')}</h2>
        {pendingAds.length === 0 ? (
          <p className="meta">{t('adminPage.noPendingAds', 'No pending ads.')}</p>
        ) : (
          <div className="admin-list">
            {pendingAds.map((ad) => (
              <div className="admin-list-row" key={ad.id} style={{ flexWrap: 'wrap', gap: 8 }}>
                <strong>{ad.title}</strong>
                <span>{ad.slot?.name}</span>
                <small>{ad.advertiser?.username ?? ad.advertiser?.email}</small>
                <small>{ad.createdAt.toISOString().slice(0, 10)}</small>
                {/* These used to be two HTML forms POSTing to
                    /api/admin/ads/[adId], which only exports PATCH — a form
                    can't send PATCH, so both buttons always 405'd and no
                    campaign was ever decided from this page. Approving also
                    opens a real Stripe authorization and now needs a
                    step-up passkey check, so rather than duplicate that
                    flow a third time this links to /admin/ads, where
                    AdminAdsClient already does it properly. The i18n pass
                    wrapped the old forms' labels; those strings went with
                    the forms. */}
                <Link className="button small" href={`/admin/ads?status=PENDING&q=${encodeURIComponent(ad.title)}`} style={{ fontSize: 12 }}>
                  {t('adminPage.review', 'Review')}
                </Link>
              </div>
            ))}
          </div>
        )}
        <p className="meta" style={{ marginTop: 8 }}>
          {t('adminPage.manageViaAdsQueue', 'Approve or reject campaigns in the')}{' '}
          <Link href="/admin/ads">{t('adminPage.adsQueue', 'Ads queue')}</Link>.
        </p>
      </section>
    </div>
  );
}

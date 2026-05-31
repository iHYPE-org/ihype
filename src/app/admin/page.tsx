import type { Metadata } from 'next';
import { AdminNav } from '@/components/AdminNav';
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
import { redirect } from 'next/navigation';
import { TabDashboardHero } from './TabDashboardHero';
import { TabDashboardGrid } from './TabDashboardGrid';
import { TabDashboardSecurity } from './TabDashboardSecurity';
import { TabDashboardArtistFunnel } from './TabDashboardArtistFunnel';
import { TabDashboardOps } from './TabDashboardOps';

export const metadata: Metadata = {
  title: 'Admin Beta Console | iHYPE.org',
  robots: { index: false, follow: false }
};

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
    db.profile.count({ where: { type: 'ARTIST', mediaUploads: { none: {} } } }).catch(() => 0),
    db.profile.count({ where: { type: 'ARTIST', mediaUploads: { some: {} }, hostedShows: { none: {} }, headlinerShows: { none: {} } } }).catch(() => 0),
    db.show.count({ where: { hypeCount: 0, status: { not: 'DRAFT' } } }).catch(() => 0),
    db.profile.findMany({ where: { type: 'ARTIST', mediaUploads: { none: {} } }, select: { name: true, slug: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 5 }).catch(() => []),
    db.socialPost.findMany({ orderBy: { generatedAt: 'desc' }, take: 5 }).catch(() => []),
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
    db.ticketOrder.findMany({
      where: { status: 'CAPTURED', chargedAt: { gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) } },
      select: { chargedAt: true, totalChargeCents: true },
    }).catch(() => [] as { chargedAt: Date | null; totalChargeCents: number }[]),
    db.accountsPayableEntry.groupBy({
      by: ['profileId'],
      where: { profileId: { not: null } },
      _sum: { amountCents: true },
      orderBy: { _sum: { amountCents: 'desc' } },
      take: 10,
    }).catch(() => []),
    db.accountsPayableEntry.groupBy({
      by: ['status'],
      _sum: { amountCents: true },
    }).catch(() => []),
    db.ad.findMany({
      where: { status: 'PENDING' },
      include: { advertiser: { select: { email: true, username: true } }, slot: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }).catch(() => []),
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

  const monthlyMap: Record<string, number> = {};
  for (const order of monthlyRevenue) {
    if (!order.chargedAt) continue;
    const key = `${order.chargedAt.getFullYear()}-${String(order.chargedAt.getMonth() + 1).padStart(2, '0')}`;
    monthlyMap[key] = (monthlyMap[key] ?? 0) + order.totalChargeCents;
  }
  const monthlyRows = Object.entries(monthlyMap).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12) as [string, number][];

  const payoutPaid = payoutTotals.find(p => p.status === 'RELEASED')?._sum.amountCents ?? 0;
  const payoutPending = payoutTotals.find(p => p.status === 'PENDING')?._sum.amountCents ?? 0;
  const platformFeeTotal = Math.round((revenueCents * 0.1));

  return (
    <main className="container section admin-console">
      <AdminNav active="dashboard" />

      <TabDashboardHero
        userCount={userCount}
        profileCount={profileCount}
        pendingVerificationCount={pendingVerificationCount}
        openReportCount={openReportCount}
        openSupportCount={openSupportCount}
        mediaCount={mediaCount}
        ticketOrderCount={ticketOrderCount}
        userSearch={userSearch}
        userSearchResults={userSearchResults}
        health={health}
        healthOperations={healthOperations}
        healthIntegrations={healthIntegrations}
        funnelAlerts={funnelAlerts}
        funnelDropoff={funnelDropoff}
        variantCounts={variantCounts}
        passkeyDiagnostics={passkeyDiagnostics}
        rateLimitMetrics={rateLimitMetrics}
      />

      <TabDashboardGrid
        featureFlags={featureFlags}
        recentTicketOrders={recentTicketOrders}
        recentShows={recentShows}
        recentUsers={recentUsers}
        recentReports={recentReports}
        recentSupport={recentSupport}
        pendingVerifications={pendingVerifications}
        recentEmails={recentEmails}
        recentAudits={recentAudits}
        revenueCents={revenueCents}
        revenueLabel={revenueLabel}
      />

      <TabDashboardSecurity
        recentSpamFlags={recentSpamFlags}
        recentLoginsCount={recentLoginsCount}
      />

      <TabDashboardArtistFunnel
        funnelStage1={funnelStage1}
        funnelStage2={funnelStage2}
        funnelStage3={funnelStage3}
        funnelStage1Recent={funnelStage1Recent}
        recentSocialPosts={recentSocialPosts}
        calendarShows={calendarShows}
      />

      <TabDashboardOps
        recentInviteCodes={recentInviteCodes}
        revenueCents={revenueCents}
        platformFeeTotal={platformFeeTotal}
        payoutPaid={payoutPaid}
        payoutPending={payoutPending}
        monthlyRows={monthlyRows}
        topEarners={topEarners}
        recentSpamFlags={recentSpamFlags}
        abTests={abTests}
        pendingAds={pendingAds}
      />
    </main>
  );
}

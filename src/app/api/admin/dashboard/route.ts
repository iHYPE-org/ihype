import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getBetaMetrics } from '@/lib/beta-metrics';
import { db } from '@/lib/db';
import { getHealthSnapshot } from '@/lib/health';
import { isAdminSession } from '@/lib/permissions';
import { getRateLimitMetrics } from '@/lib/rate-limit';
import {
  areDemoLoginsEnabledRuntime,
  getRuntimeFlag,
  isInviteCodeRequiredRuntime,
  shouldHideDemoContentRuntime,
} from '@/lib/runtime-flags';
import { isBlobMediaStorageConfigured } from '@/lib/media-storage';
import { isPaymentProcessingConfigured } from '@/lib/payments';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id || !isAdminSession(session)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
      recentShows,
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
        include: { reporter: { select: { email: true, username: true } } },
      }).catch(() => []),
      db.supportRequest.findMany({ orderBy: { createdAt: 'desc' }, take: 6 }).catch(() => []),
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
          verificationSubmittedAt: true,
        },
      }).catch(() => []),
      db.emailDeliveryLog.findMany({ orderBy: { createdAt: 'desc' }, take: 6 }).catch(() => []),
      db.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
        include: { actor: { select: { email: true, username: true } } },
      }).catch(() => []),
      db.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: { email: true, username: true, role: true, createdAt: true },
      }).catch(() => []),
      db.auditLog.findMany({
        where: { action: { startsWith: 'signup_funnel:' }, createdAt: { gte: funnelSince } },
        orderBy: { createdAt: 'desc' },
        take: 250,
        select: { action: true, metadata: true },
      }).catch(() => []),
      getHealthSnapshot(),
      db.ticketOrder.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { show: { select: { title: true } } },
      }).catch(() => []),
      db.ticketOrder.aggregate({
        where: { status: 'CAPTURED' },
        _sum: { totalChargeCents: true },
      }).catch(() => ({ _sum: { totalChargeCents: null } })),
      db.show.findMany({
        take: 8,
        orderBy: { createdAt: 'desc' },
        include: {
          venueProfile: { select: { name: true } },
          _count: { select: { tickets: true } },
        },
      }).catch(() => []),
    ]);

    const [
      demoLoginsEnabled,
      inviteOnlySignupEnabled,
      demoContentHidden,
      blobMediaStorageEnabled,
      ticketPaymentCaptureEnabled,
    ] = await Promise.all([
      areDemoLoginsEnabledRuntime(),
      isInviteCodeRequiredRuntime(),
      shouldHideDemoContentRuntime(),
      getRuntimeFlag('blob_media_storage', isBlobMediaStorageConfigured()),
      getRuntimeFlag('ticket_payment_capture', isPaymentProcessingConfigured()),
    ]);

    const rateLimitMetrics = await getRateLimitMetrics(10);
    const betaMetrics = await getBetaMetrics().catch(() => null);

    return NextResponse.json({
      betaMetrics,
      metrics: {
        userCount,
        profileCount,
        pendingVerificationCount,
        openReportCount,
        openSupportCount,
        mediaCount,
        ticketOrderCount,
        revenueCents: revenueAgg._sum.totalChargeCents ?? 0,
      },
      recentReports,
      recentSupport,
      pendingVerifications,
      recentEmails,
      recentAudits,
      recentUsers,
      signupFunnelAudits,
      health,
      recentTicketOrders,
      recentShows,
      featureFlags: [
        { key: 'demo_logins', label: 'Demo logins', enabled: demoLoginsEnabled },
        { key: 'invite_only_signup', label: 'Invite-only signup', enabled: inviteOnlySignupEnabled },
        { key: 'hide_demo_content', label: 'Hide demo content', enabled: demoContentHidden },
        { key: 'blob_media_storage', label: 'Blob media storage', enabled: blobMediaStorageEnabled },
        { key: 'ticket_payment_capture', label: 'Ticket payment capture', enabled: ticketPaymentCaptureEnabled },
      ],
      rateLimitMetrics,
    });
  } catch (err) {
    console.error('[api/admin/dashboard] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

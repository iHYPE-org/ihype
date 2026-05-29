import { db } from '@/lib/db';
import { getEmailDeliveryReadiness, isEmailDeliveryConfigured, isSmtpEmailConfigured } from '@/lib/mailer';
import { isBlobMediaStorageConfigured } from '@/lib/media-storage';
import { getPaymentProcessingReadiness, isPaymentProcessingConfigured } from '@/lib/payments';
import { areDemoLoginsEnabledRuntime, isInviteCodeRequiredRuntime, shouldHideDemoContentRuntime } from '@/lib/runtime-flags';

export async function getHealthSnapshot() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const startedAt = Date.now();

  try {
    const [userCount, openReportCount, openSupportCount, failedEmailCount, pendingVerificationCount, reservedTicketCount] =
      await Promise.all([
        db.user.count(),
        db.contentReport.count({ where: { status: 'OPEN' } }),
        db.supportRequest.count({ where: { status: 'OPEN' } }),
        db.emailDeliveryLog.count({ where: { status: 'FAILED', createdAt: { gte: since } } }),
        db.profile.count({ where: { verificationStatus: 'PENDING' } }),
        db.ticketOrder.count({ where: { status: 'RESERVED' } })
      ]);

    const [demoLogins, inviteOnlySignup, demoContentHidden] = await Promise.all([
      areDemoLoginsEnabledRuntime(),
      isInviteCodeRequiredRuntime(),
      shouldHideDemoContentRuntime()
    ]);

    const emailReadiness = getEmailDeliveryReadiness();
    const paymentReadiness = getPaymentProcessingReadiness();
    const launchBlockers = [
      ...(userCount === 0 ? ['Seed launch content so public discovery is not empty.'] : []),
      ...emailReadiness.blockers,
      ...paymentReadiness.blockers
    ];

    return {
      status: 'ok' as const,
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      database: {
        ok: true,
        users: userCount
      },
      operations: {
        openReports: openReportCount,
        openSupportRequests: openSupportCount,
        failedEmails24h: failedEmailCount,
        pendingVerifications: pendingVerificationCount,
        reservedTicketOrders: reservedTicketCount
      },
      integrations: {
        emailDelivery: isEmailDeliveryConfigured(),
        smtpEmail: isSmtpEmailConfigured(),
        blobMediaStorage: isBlobMediaStorageConfigured(),
        ticketPaymentCapture: isPaymentProcessingConfigured()
      },
      safety: {
        demoLogins,
        inviteOnlySignup,
        demoContentHidden
      },
      sentryConfigured: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
      stripeMode: process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_')
        ? 'live'
        : process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')
          ? 'test'
          : 'not_configured',
      launchReadiness: {
        ready: launchBlockers.length === 0,
        blockers: launchBlockers
      },
      warnings: process.env.NODE_ENV === 'production'
        ? [
            !process.env.VAPID_PUBLIC_KEY && 'VAPID_PUBLIC_KEY is not set (push notifications disabled)',
            !process.env.VAPID_PRIVATE_KEY && 'VAPID_PRIVATE_KEY is not set (push notifications disabled)',
            !process.env.VAPID_SUBJECT && 'VAPID_SUBJECT is not set (push notifications disabled)',
            !process.env.RESEND_API_KEY && 'RESEND_API_KEY is not set (email delivery disabled)',
            !process.env.CRON_SECRET && 'CRON_SECRET is not set (cron jobs unprotected)',
            !process.env.NEXT_PUBLIC_SENTRY_DSN && 'NEXT_PUBLIC_SENTRY_DSN is not set (error tracking disabled)',
          ].filter(Boolean) as string[]
        : []
    };
  } catch (error) {
    return {
      status: 'degraded' as const,
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      database: {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown database health error'
      }
    };
  }
}

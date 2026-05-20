import { db } from '@/lib/db';
import { isEmailDeliveryConfigured, isSmtpEmailConfigured } from '@/lib/mailer';
import { isBlobMediaStorageConfigured } from '@/lib/media-storage';
import { isPaymentProcessingConfigured } from '@/lib/payments';
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
      }
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

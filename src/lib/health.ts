import { db } from '@/lib/db';
import { getEmailDeliveryReadiness, isEmailDeliveryConfigured, isSmtpEmailConfigured } from '@/lib/mailer';
import { isBlobMediaStorageConfigured } from '@/lib/media-storage';
import { getPaymentProcessingReadiness, isPaymentProcessingConfigured } from '@/lib/payments';
import {
  areDemoLoginsEnabledRuntime,
  areRegistrationsEnabledRuntime,
  areUploadsEnabledRuntime,
  isAdvertisingEnabledRuntime,
  arePaymentsEnabledRuntime,
  isTicketingEnabledRuntime,
  isRadioEnabledRuntime,
  areMapsEnabledRuntime,
  isInviteCodeRequiredRuntime,
  isOutboundEmailEnabledRuntime,
  shouldHideDemoContentRuntime,
} from '@/lib/runtime-flags';
import { readRuntimeEnv } from '@/lib/runtime-env';
import { buildAlphaBlockers, evaluateRestoreDrill } from '@/lib/alpha-readiness';

export async function getHealthSnapshot() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const startedAt = Date.now();
  const now = new Date();
  const stripeSecretKey = readRuntimeEnv('STRIPE_SECRET_KEY');

  try {
    const [
      userCount,
      openReportCount,
      openSupportCount,
      failedEmailCount,
      pendingVerificationCount,
      reservedTicketCount,
      pendingNotificationCount,
      failedNotificationCount,
      oldestPendingNotification,
      administratorCount,
      playableTrackCount,
      discoverableArtistCount,
      discoverableVenueCount,
      upcomingEventCount,
      scheduledRadioShowCount,
    ] =
      await Promise.all([
        db.user.count(),
        db.contentReport.count({ where: { status: 'OPEN' } }),
        db.supportRequest.count({ where: { status: 'OPEN' } }),
        db.emailDeliveryLog.count({ where: { status: 'FAILED', createdAt: { gte: since } } }),
        db.profile.count({ where: { verificationStatus: 'PENDING', verificationRequested: true } }),
        db.ticketOrder.count({ where: { status: 'RESERVED' } }),
        db.notificationJob.count({ where: { status: 'PENDING' } }),
        db.notificationJob.count({ where: { status: 'FAILED' } }),
        db.notificationJob.findFirst({
          where: { status: 'PENDING' },
          orderBy: { createdAt: 'asc' },
          select: { createdAt: true },
        }),
        db.user.count({ where: { role: 'ADMIN' } }),
        db.artistMediaAsset.count({
          where: {
            isPublished: true,
            OR: [{ publishAt: null }, { publishAt: { lte: now } }],
            profile: { discoverable: true },
          },
        }),
        db.profile.count({ where: { type: 'ARTIST', discoverable: true } }),
        db.profile.count({ where: { type: 'VENUE', discoverable: true } }),
        db.show.count({ where: { isRadioShow: false, status: 'SCHEDULED', startsAt: { gte: now } } }),
        db.show.count({ where: { isRadioShow: true, status: { in: ['SCHEDULED', 'LIVE'] } } }),
      ]);

    const [
      demoLogins,
      inviteOnlySignup,
      demoContentHidden,
      registrationsEnabled,
      uploadsEnabled,
      outboundEmailEnabled,
      advertisingEnabled,
      paymentsEnabled,
      ticketsEnabled,
      radioEnabled,
      mapsEnabled,
    ] = await Promise.all([
      areDemoLoginsEnabledRuntime(),
      isInviteCodeRequiredRuntime(),
      shouldHideDemoContentRuntime(),
      areRegistrationsEnabledRuntime(),
      areUploadsEnabledRuntime(),
      isOutboundEmailEnabledRuntime(),
      isAdvertisingEnabledRuntime(),
      arePaymentsEnabledRuntime(),
      isTicketingEnabledRuntime(),
      isRadioEnabledRuntime(),
      areMapsEnabledRuntime(),
    ]);

    const emailReadiness = getEmailDeliveryReadiness();
    const paymentReadiness = getPaymentProcessingReadiness();
    const oldestPendingNotificationAgeMinutes = oldestPendingNotification
      ? Math.floor((Date.now() - oldestPendingNotification.createdAt.getTime()) / 60_000)
      : null;
    const runtimeBlockers = [
      !readRuntimeEnv('AUTH_SECRET') && 'Set AUTH_SECRET for session signing.',
      !readRuntimeEnv('CRON_SECRET') && 'Set CRON_SECRET before enabling scheduled operations.',
      !readRuntimeEnv('TURNSTILE_SECRET_KEY') && 'Set TURNSTILE_SECRET_KEY so production signup abuse checks fail closed.',
      !readRuntimeEnv('RESEND_WEBHOOK_SECRET') && 'Set RESEND_WEBHOOK_SECRET so bounce and complaint events can be verified.',
      !readRuntimeEnv('ADMIN_DEVICE_SECRET') && 'Set ADMIN_DEVICE_SECRET for protected admin-device registration.',
    ].filter(Boolean) as string[];
    const launchBlockers = [
      ...(userCount === 0 ? ['Seed launch content so public discovery is not empty.'] : []),
      ...emailReadiness.blockers,
      ...paymentReadiness.blockers,
      ...runtimeBlockers,
      ...(!registrationsEnabled ? ['New registrations are paused by the runtime safety switch.'] : []),
      ...(!uploadsEnabled ? ['Media uploads are paused by the runtime safety switch.'] : []),
      ...(!outboundEmailEnabled ? ['Outbound email is paused by the runtime safety switch.'] : []),
      ...(!paymentsEnabled ? ['New payment operations are paused by the runtime safety switch.'] : []),
      ...(!ticketsEnabled ? ['New ticket sales are paused by the runtime safety switch.'] : []),
      ...(!radioEnabled ? ['Radio delivery is paused by the runtime safety switch.'] : []),
      ...(!mapsEnabled ? ['Location map lookups are paused by the runtime safety switch.'] : []),
      ...(failedNotificationCount > 0
        ? [`Resolve ${failedNotificationCount} permanently failed notification job(s).`]
        : []),
      ...(oldestPendingNotificationAgeMinutes !== null && oldestPendingNotificationAgeMinutes > 30
        ? [`Notification delivery is backlogged; oldest pending job is ${oldestPendingNotificationAgeMinutes} minutes old.`]
        : []),
    ];
    const restoreDrill = evaluateRestoreDrill(readRuntimeEnv('RESTORE_DRILL_VERIFIED_AT'));
    const alphaBlockers = buildAlphaBlockers({
      administrators: administratorCount,
      playableTracks: playableTrackCount,
      discoverableArtists: discoverableArtistCount,
      discoverableVenues: discoverableVenueCount,
      upcomingEvents: upcomingEventCount,
      scheduledRadioShows: scheduledRadioShowCount,
      inviteOnlySignup,
      restoreDrillReady: restoreDrill.ready,
      launchBlockers,
    });

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
        reservedTicketOrders: reservedTicketCount,
        notificationJobs: {
          pending: pendingNotificationCount,
          failed: failedNotificationCount,
          oldestPendingAgeMinutes: oldestPendingNotificationAgeMinutes,
        },
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
        demoContentHidden,
        registrationsEnabled,
        uploadsEnabled,
        outboundEmailEnabled,
        advertisingEnabled,
        paymentsEnabled,
        ticketsEnabled,
        radioEnabled,
        mapsEnabled,
      },
      sentryConfigured: Boolean(readRuntimeEnv('SENTRY_DSN') ?? readRuntimeEnv('NEXT_PUBLIC_SENTRY_DSN')),
      stripeMode: stripeSecretKey?.startsWith('sk_live_')
        ? 'live'
        : stripeSecretKey?.startsWith('sk_test_')
          ? 'test'
          : 'not_configured',
      launchReadiness: {
        ready: launchBlockers.length === 0,
        blockers: launchBlockers
      },
      alphaReadiness: {
        ready: alphaBlockers.length === 0,
        blockers: alphaBlockers,
        administrators: administratorCount,
        restoreDrill,
        content: {
          playableTracks: playableTrackCount,
          discoverableArtists: discoverableArtistCount,
          discoverableVenues: discoverableVenueCount,
          upcomingEvents: upcomingEventCount,
          scheduledRadioShows: scheduledRadioShowCount,
        },
      },
      warnings: process.env.NODE_ENV === 'production'
        ? [
            !readRuntimeEnv('VAPID_PUBLIC_KEY') && 'VAPID_PUBLIC_KEY is not set (push notifications disabled)',
            !readRuntimeEnv('VAPID_PRIVATE_KEY') && 'VAPID_PRIVATE_KEY is not set (push notifications disabled)',
            !readRuntimeEnv('VAPID_SUBJECT') && 'VAPID_SUBJECT is not set (push notifications disabled)',
            !readRuntimeEnv('RESEND_API_KEY') && 'RESEND_API_KEY is not set (email delivery disabled)',
            !readRuntimeEnv('CRON_SECRET') && 'CRON_SECRET is not set (cron jobs unprotected)',
            !(readRuntimeEnv('SENTRY_DSN') ?? readRuntimeEnv('NEXT_PUBLIC_SENTRY_DSN')) && 'SENTRY_DSN is not set (error tracking disabled)',
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

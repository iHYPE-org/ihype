import { db } from '@/lib/db';
import { getEmailDeliveryReadiness, isEmailDeliveryConfigured, isSmtpEmailConfigured } from '@/lib/mailer';
import { isBlobMediaStorageConfigured } from '@/lib/media-storage';
import { getPaymentProcessingReadiness, isPaymentProcessingConfigured } from '@/lib/payments';
import {
  areRegistrationsEnabledRuntime,
  areUploadsEnabledRuntime,
  isAdvertisingEnabledRuntime,
  arePaymentsEnabledRuntime,
  isTicketingEnabledRuntime,
  isRadioEnabledRuntime,
  areMapsEnabledRuntime,
  isInviteCodeRequiredRuntime,
  isOutboundEmailEnabledRuntime,
  shouldHideDemoContent,
} from '@/lib/runtime-flags';
import { readRuntimeEnv } from '@/lib/runtime-env';
import { readSigningSecrets } from '@/lib/signing-secrets';
import { orderSigningSecrets } from '@/lib/signing-secret-order';
import { isNativePushConfigured } from '@/lib/native-push';
import { buildAlphaBlockers, evaluateRestoreDrill, parseAutomatedDrillAt } from '@/lib/alpha-readiness';
import { kvGet } from '@/lib/kv';

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
      sentEmailCount,
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
    ] =
      await Promise.all([
        db.user.count(),
        db.contentReport.count({ where: { status: 'OPEN' } }),
        db.supportRequest.count({ where: { status: 'OPEN' } }),
        db.emailDeliveryLog.count({ where: { status: 'FAILED', createdAt: { gte: since } } }),
        db.emailDeliveryLog.count({ where: { status: 'SENT', createdAt: { gte: since } } }),
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
        db.show.count({ where: { status: 'SCHEDULED', startsAt: { gte: now } } }),
      ]);

    const [
      inviteOnlySignup,
      registrationsEnabled,
      uploadsEnabled,
      outboundEmailEnabled,
      advertisingEnabled,
      paymentsEnabled,
      ticketsEnabled,
      radioEnabled,
      mapsEnabled,
    ] = await Promise.all([
      isInviteCodeRequiredRuntime(),
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
    /* Either source of restore evidence: the operator's stamp, or the nightly
       drill's own pass key. An unreadable KV is no evidence, not a failure. */
    const automatedDrillAt = await kvGet<number | string>('cron-alive:restore-drill').then(parseAutomatedDrillAt).catch(() => null);
    /* Last night's Stripe reconciliation, as the cron stored it: how many
       disagreements about money, and when it looked. Absent means the job
       has not run in three days, which the stale-cron alert also says. */
    const stripeReconciliation = await kvGet<string | { at?: string; money?: number; info?: number }>('stripe-reconcile:last')
      .then((raw) => {
        const parsed = typeof raw === 'string' ? (JSON.parse(raw) as { at?: string; money?: number; info?: number }) : raw;
        return parsed && typeof parsed === 'object' && typeof parsed.at === 'string'
          ? { at: parsed.at, money: Number(parsed.money ?? 0), info: Number(parsed.info ?? 0) }
          : null;
      })
      .catch(() => null);
    const restoreDrill = evaluateRestoreDrill(readRuntimeEnv('RESTORE_DRILL_VERIFIED_AT'), Date.now(), automatedDrillAt);
    const alphaBlockers = buildAlphaBlockers({
      administrators: administratorCount,
      discoverableArtists: discoverableArtistCount,
      discoverableVenues: discoverableVenueCount,
      upcomingEvents: upcomingEventCount,
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
        sentEmails24h: sentEmailCount,
        /* Both halves of a signing-secret rotation, because they read from
           different places and only agreement is safe: the signer reaches the
           Cloudflare binding, while NextAuth's verifier is built at module
           scope from `process.env`. A rotation secret visible to one and not
           the other signs cookies nobody can verify. Counts only — never a
           key, and never which one. */
        signingSecrets: {
          signer: readSigningSecrets().length,
          verifier: orderSigningSecrets(process.env as Record<string, string | undefined>).length,
        },
        stripeReconciliation,
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
        ticketPaymentCapture: isPaymentProcessingConfigured(),
        // CONFIGURATION, not delivery. True means the three FCM service-account
        // secrets are set, which is the leg whose absence is silent — the app
        // registers device tokens and nothing ever arrives. It does NOT mean a
        // push reaches an iPhone: FCM proxies to APNs only once the APNs auth
        // key is uploaded in the Firebase console, and that is Apple-side state
        // nothing here can read. See docs/runbooks/push-setup.md.
        nativePush: isNativePushConfigured(),
      },
      safety: {
        inviteOnlySignup,
        // The one demo switch: NODE_ENV plus FEATURE_ENABLE_DEMO_LOGINS, read
        // synchronously by every gate. The KV toggles that used to sit beside
        // it here were read by nothing that enforced them (2026-09-06 audit).
        demoContentHidden: shouldHideDemoContent(),
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
        blockers: launchBlockers,
        /* Lets a caller tell "closed on purpose" apart from "misconfigured".
           See the comment in src/lib/payments.ts — the post-deploy smoke test
           and the readiness cron both need this distinction, and both were
           treating the two as one thing. */
        paymentsDisabledByFlag: paymentReadiness.paymentsDisabledByFlag
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

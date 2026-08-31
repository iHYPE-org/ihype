import { NextRequest, NextResponse } from 'next/server';
import { isCronRequestAuthorized } from '@/lib/cron-auth';
import { getAdminAlertRecipients } from '@/lib/env';
import { pingCronAlive, WEEKLY_TTL } from '@/lib/cron-health';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const job = searchParams.get('job');

  switch (job) {
    case 'digest': {
      const { sendDigestsToAllEligibleUsers } = await import('@/lib/email-digest');
      const summary = await sendDigestsToAllEligibleUsers();
      await pingCronAlive('digest');
      return NextResponse.json(summary);
    }

    case 'artist-digest': {
      const { sendArtistWeeklyDigestBatch } = await import('@/lib/artist-digest');
      const { db } = await import('@/lib/db');
      const profiles = await db.profile.findMany({
        where: { type: 'ARTIST' },
        select: { id: true, name: true, owner: { select: { id: true, email: true, name: true } } }
      });
      const { sent } = await sendArtistWeeklyDigestBatch(profiles);
      return NextResponse.json({ ok: true, sent });
    }

    case 'health-check': {
      const { getHealthSnapshot } = await import('@/lib/health');
      const { isEmailDeliveryConfigured, getEmailDeliveryReadiness, sendGenericEmail, sendOperationalEmail } = await import('@/lib/mailer');
      const { checkCronHealth } = await import('@/lib/cron-health');

      // Email cannot be the channel that reports email being down. Every
      // alert below is an email, and each one is individually guarded on
      // isEmailDeliveryConfigured() — so a misconfigured mailer made this
      // whole job a silent no-op. Production sent zero emails for 35 days
      // that way. Report it through the logger (Sentry) instead, which does
      // not depend on the subsystem being reported on.
      const emailReady = isEmailDeliveryConfigured();
      if (!emailReady) {
        log.error(
          '[cron/health-check]',
          { blockers: getEmailDeliveryReadiness().blockers },
          'email delivery is NOT configured in production — every alert, magic link and ticket email is failing'
        );
      }

      const snapshot = await getHealthSnapshot();
      if (snapshot.status !== 'ok' && isEmailDeliveryConfigured()) {
        try {
          const summary = JSON.stringify(snapshot, null, 2);
          await sendGenericEmail({
            to: getAdminAlertRecipients(),
            subject: '[iHYPE] Health check failure',
            text: `iHYPE health check returned non-ok status.\n\n${summary}`,
            html: `<p>iHYPE health check returned non-ok status.</p><pre style="font-family:monospace;font-size:12px;background:var(--bg);color:#eef1f6;padding:12px;border-radius:6px;white-space:pre-wrap;">${summary.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</pre>`
          });
        } catch (err) {
          log.error('[cron/health-check]', err instanceof Error ? err : { error: String(err) }, 'alert email failed');
        }
      }
      /* Not an alert when the ONLY blocker is the deliberate paid-ticketing
         flag. It is throttled to once a day, but a daily email about a state
         the administrators chose is still an email nobody reads — and then
         neither is the one that matters. Anything else in `blockers` (a
         missing Stripe secret, a test key in production) still alerts, which
         is the case this exists for. */
      if (
        snapshot.status === 'ok' &&
        !snapshot.launchReadiness.ready &&
        !snapshot.launchReadiness.paymentsDisabledByFlag &&
        isEmailDeliveryConfigured()
      ) {
        try {
          const { kvGet, kvPut } = await import('@/lib/kv');
          const lastAlert = await kvGet<number>('health-alert:launch-readiness');
          const shouldAlert = !lastAlert || Date.now() - lastAlert > 24 * 60 * 60 * 1000;
          if (shouldAlert) {
            await sendGenericEmail({
              to: getAdminAlertRecipients(),
              subject: '[iHYPE] Launch readiness blockers',
              text: snapshot.launchReadiness.blockers.join('\n'),
              html: `<ul>${snapshot.launchReadiness.blockers.map((item) => `<li>${item}</li>`).join('')}</ul>`
            });
            await kvPut('health-alert:launch-readiness', Date.now(), { ex: 24 * 60 * 60 });
          }
        } catch (err) {
          log.error('[cron/health-check]', err instanceof Error ? err : { error: String(err) }, 'launch readiness alert failed');
        }
      }
      const cronHealth = await checkCronHealth();
      if (cronHealth.stale.length > 0) {
        try {
          const { kvGet, kvPut } = await import('@/lib/kv');
          const lastCronAlert = await kvGet<number>('health-alert:stale-crons');
          const shouldAlert = !lastCronAlert || Date.now() - lastCronAlert > 24 * 60 * 60 * 1000;
          if (shouldAlert) {
            await sendOperationalEmail({ to: getAdminAlertRecipients(), subject: '[iHYPE] Stale cron jobs detected', text: `These cron jobs haven't run in their expected window: ${cronHealth.stale.join(', ')}`, html: `<p>Stale crons: <strong>${cronHealth.stale.join(', ')}</strong></p>` }, 'stale-crons');
            await kvPut('health-alert:stale-crons', Date.now(), { ex: 24 * 60 * 60 });
          }
        } catch { /* KV unavailable */ }
      }
      return NextResponse.json({ ...snapshot, cronHealth }, {
        status: snapshot.status === 'ok' ? 200 : 503,
        headers: { 'Cache-Control': 'no-store' }
      });
    }

    case 'onboarding': {
      const { db } = await import('@/lib/db');
      const { sendDay3Email, sendDay7Email } = await import('@/lib/onboarding-emails');
      const now = new Date();
      const day3Start = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000);
      const day3End = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      const day7Start = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
      const day7End = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const [day3Users, day7Users] = await Promise.all([
        db.user.findMany({ where: { createdAt: { gte: day3Start, lt: day3End } }, select: { id: true, profileHypeEvents: { take: 1, select: { id: true } } } }),
        db.user.findMany({ where: { createdAt: { gte: day7Start, lt: day7End } }, select: { id: true, profileHypeEvents: { take: 1, select: { id: true } } } })
      ]);
      let sent3 = 0, sent7 = 0;
      for (const user of day3Users) {
        if (user.profileHypeEvents.length === 0) { try { await sendDay3Email(user.id); sent3++; } catch { /* continue */ } }
      }
      for (const user of day7Users) {
        if (user.profileHypeEvents.length === 0) { try { await sendDay7Email(user.id); sent7++; } catch { /* continue */ } }
      }
      await pingCronAlive('onboarding');
      return NextResponse.json({ ok: true, sent3, sent7 });
    }

    case 'show-reminders': {
      const { sendShowReminders } = await import('@/lib/show-reminders');
      const { sent } = await sendShowReminders();
      await pingCronAlive('show-reminders');
      return NextResponse.json({ ok: true, sent });
    }

    case 'db-health': {
      const { db } = await import('@/lib/db');
      const { sendOperationalEmail } = await import('@/lib/mailer');
      const [userCountResult, profileCountResult] = await Promise.all([
        db.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*) as count FROM "User"`,
        db.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*) as count FROM "Profile"`
      ]);
      const userCount = Number(userCountResult[0]?.count ?? 0);
      const profileCount = Number(profileCountResult[0]?.count ?? 0);
      const alerts: string[] = [];
      if (userCount === 0) alerts.push('User count is 0 — possible data loss or connection issue.');
      if (profileCount === 0) alerts.push('Profile count is 0 — possible data loss or connection issue.');
      try {
        const { kvGet, kvPut } = await import('@/lib/kv');
        const lastUserCount = await kvGet<number>('db-health:user-count');
        const lastProfileCount = await kvGet<number>('db-health:profile-count');
        if (lastUserCount !== null && userCount < lastUserCount * 0.8) alerts.push(`User count dropped from ${lastUserCount} to ${userCount} (>20% decrease).`);
        if (lastProfileCount !== null && profileCount < lastProfileCount * 0.8) alerts.push(`Profile count dropped from ${lastProfileCount} to ${profileCount} (>20% decrease).`);
        await kvPut('db-health:user-count', userCount);
        await kvPut('db-health:profile-count', profileCount);
      } catch { /* KV not available */ }
      if (alerts.length > 0) {
        await sendOperationalEmail({ to: getAdminAlertRecipients(), subject: '[iHYPE] DB health alert', text: alerts.join('\n\n') + `\n\nCurrent counts: users=${userCount}, profiles=${profileCount}`, html: `<p>${alerts.map(a => `<strong>${a}</strong>`).join('<br/><br/>')}</p>` }, 'db-health');
      }
      await pingCronAlive('db-health');
      return NextResponse.json({ ok: alerts.length === 0, userCount, profileCount, alerts, checkedAt: new Date().toISOString() });
    }

    case 'weekly-picks': {
      const { sendWeeklyPicksEmails } = await import('@/lib/weekly-picks');
      const result = await sendWeeklyPicksEmails();
      await pingCronAlive('weekly-picks', WEEKLY_TTL);
      return NextResponse.json({ ok: true, ...result });
    }

    case 'held-track-notice': {
      const { notifyStaleHeldTracks } = await import('@/lib/held-track-notice');
      const result = await notifyStaleHeldTracks();
      await pingCronAlive('held-track-notice');
      return NextResponse.json(result);
    }

    case 'workbench-digest': {
      const { sendWorkbenchDigest } = await import('@/lib/workbench-digest');
      const result = await sendWorkbenchDigest();
      await pingCronAlive('workbench-digest');
      return NextResponse.json(result);
    }

    case 'admin-report': {
      const { sendAdminWeeklyReport } = await import('@/lib/admin-report');
      const result = await sendAdminWeeklyReport();
      return NextResponse.json(result);
    }

    case 'new-to-scene': {
      const { sendNewToSceneEmail } = await import('@/lib/new-to-scene');
      const result = await sendNewToSceneEmail();
      await pingCronAlive('new-to-scene');
      return NextResponse.json({ ok: true, ...result });
    }

    case 'feature-shows': {
      const { db } = await import('@/lib/db');
      const hotShows = await db.show.findMany({
        where: { status: 'SCHEDULED', startsAt: { gte: new Date() } },
        select: { id: true, hypeCount: true, tags: true },
        orderBy: { hypeCount: 'desc' },
        take: 5
      });
      const unfeaturedIds = hotShows.filter(s => !s.tags.includes('featured')).map(s => s.id);
      let updated = 0;
      if (unfeaturedIds.length > 0) {
        await Promise.all(
          unfeaturedIds.map(id => db.show.update({ where: { id }, data: { tags: { push: 'featured' } } }))
        );
        updated = unfeaturedIds.length;
      }
      await pingCronAlive('feature-shows');
      return NextResponse.json({ ok: true, updated });
    }

    case 'flag-spam': {
      const { db } = await import('@/lib/db');
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const stale = await db.user.findMany({
        where: {
          createdAt: { lt: cutoff },
          role: 'FAN',
          profileHypeEvents: { none: {} },
          profiles: { none: {} },
        },
        select: { id: true },
        take: 100
      });
      const staleIds = stale.map(u => u.id);
      const alreadyFlagged = staleIds.length
        ? await db.auditLog.findMany({
            where: { actorUserId: null, action: 'SPAM_FLAGGED', entityId: { in: staleIds } },
            select: { entityId: true }
          })
        : [];
      const flaggedSet = new Set(alreadyFlagged.map(l => l.entityId));
      const toFlag = staleIds.filter(id => !flaggedSet.has(id));
      let flagged = 0;
      if (toFlag.length > 0) {
        await db.auditLog.createMany({
          data: toFlag.map(id => ({ actorUserId: null, action: 'SPAM_FLAGGED', entityType: 'User', entityId: id, metadata: {} }))
        });
        flagged = toFlag.length;
      }
      return NextResponse.json({ ok: true, flagged });
    }

    case 'show-payouts': {
      const { triggerShowPayouts } = await import('@/lib/show-payouts');
      const result = await triggerShowPayouts();
      await pingCronAlive('show-payouts');
      return NextResponse.json({ ok: true, ...result });
    }

    case 'ad-settlement': {
      const { settleEndedAdCampaigns } = await import('@/lib/ad-settlement');
      const result = await settleEndedAdCampaigns();
      await pingCronAlive('ad-settlement');
      return NextResponse.json({ ok: true, ...result });
    }

    case 'artist-onboarding': {
      const { sendArtistOnboardingNudges } = await import('@/lib/artist-onboarding');
      const result = await sendArtistOnboardingNudges();
      await pingCronAlive('artist-onboarding');
      return NextResponse.json({ ok: true, ...result });
    }

    case 'close-stale-bookings': {
      const { db } = await import('@/lib/db');
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const result = await db.bookingRequest.updateMany({
        where: { status: 'pending', createdAt: { lt: cutoff } },
        data: { status: 'expired' }
      });
      await pingCronAlive('close-stale-bookings');
      return NextResponse.json({ ok: true, closed: result.count });
    }

    case 'follow-digest': {
      const { sendFollowDigest } = await import('@/lib/follow-digest');
      const result = await sendFollowDigest();
      await pingCronAlive('follow-digest', WEEKLY_TTL);
      return NextResponse.json({ ok: true, ...result });
    }

    case 'media-backfill': {
      /* Moves media that predates working object storage out of Postgres and
         into R2. DRY RUN unless `apply=1`, idempotent, and it never drops an
         inline copy before the R2 write has come back — so it is safe to call
         repeatedly and safe to call by mistake.
           ?job=media-backfill                 → measure, write nothing
           ?job=media-backfill&apply=1&limit=25 → move up to 25 items
         `more: true` in the response means candidates remain; call again.
         Deliberately NOT on a schedule in wrangler.cron.toml: this is a
         one-off catch-up, and a recurring job whose steady state is "nothing
         to do" is a job nobody reads the output of. */
      const { runMediaBackfill } = await import('@/lib/media-backfill');
      const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? 10) || 10, 1), 50);
      const summary = await runMediaBackfill({ limit, apply: searchParams.get('apply') === '1' });
      return NextResponse.json({ ok: summary.errors.length === 0, ...summary });
    }

    case 'session-cleanup': {
      const { db } = await import('@/lib/db');
      const result = await db.session.deleteMany({ where: { expires: { lt: new Date() } } });
      await pingCronAlive('session-cleanup');
      return NextResponse.json({ ok: true, deleted: result.count });
    }

    case 'push-cleanup': {
      const { db } = await import('@/lib/db');
      const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const result = await db.pushSubscription.deleteMany({
        where: { createdAt: { lt: cutoff } },
      });
      await pingCronAlive('push-cleanup');
      return NextResponse.json({ ok: true, deleted: result.count });
    }

    case 'identity-detach': {
      // Published privacy promise (/legal, Support → Privacy): identity
      // metadata is detached from activity logs after 30 days by default.
      const { scrubAgedAuditLogIps } = await import('@/lib/privacy-actions');
      const scrubbed = await scrubAgedAuditLogIps();
      await pingCronAlive('identity-detach');
      return NextResponse.json({ ok: true, scrubbed });
    }

    case 'audit-log-rotate': {
      const { db } = await import('@/lib/db');
      const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const result = await db.auditLog.deleteMany({ where: { createdAt: { lt: cutoff }, action: { notIn: ['PAYOUT_TRIGGERED', 'DMCA_TAKEDOWN', 'DMCA_PENDING_REVIEW'] } } });
      await pingCronAlive('audit-log-rotate', WEEKLY_TTL);
      return NextResponse.json({ ok: true, deleted: result.count });
    }

    case 'stripe-connect-health': {
      /* RECONCILES, and used to only complain.
       *
       * KYC IS ASYNCHRONOUS AND THAT IS THE WHOLE PROBLEM. A member finishes
       * hosted onboarding and Stripe verifies them minutes or days later, long
       * after they have closed the tab — so `/api/stripe/connect/return`, which
       * checks readiness at the moment they come back, correctly finds them not
       * ready and marks nothing.
       *
       * The intended backstop was the v1 `account.updated` webhook. For a
       * recipient-only account that backstop does not exist: Stripe's own
       * migration guide says v2 Accounts emit v1 events "depending on the
       * updated configuration", and names the MERCHANT configuration as what
       * emits v1 `account.updated`. A recipient capability going active
       * announces itself on the v2 thin event
       * `v2.core.account[configuration.recipient].capability_status_updated`,
       * which needs a v2 event destination scoped to "Your account" — one this
       * platform has not created. So for every artist and promoter, nothing
       * was ever going to flip the flag after they left the page. Their shows
       * would settle PLATFORM forever, reporting no fault, because nothing is
       * faulty — it is just never asked.
       *
       * Asking Stripe on a schedule closes that with no dashboard
       * configuration at all, and keeps working if an event is ever missed or
       * a destination is deleted. A v2 event destination is still worth adding
       * for latency (this run is 6-hourly); it is no longer load-bearing.
       *
       * PROMOTE ONLY, never demote — same one-way rule the webhook follows. A
       * lapsed verification is a human decision, not something a cron should
       * silently switch off mid-show-week.
       *
       * Bounded per run: this makes one Stripe call per pending profile, and
       * an unbounded loop here is a Worker timeout on the day someone runs a
       * signup campaign. The leftovers are picked up by the next run. */
      const { db } = await import('@/lib/db');
      const { sendOperationalEmail } = await import('@/lib/mailer');
      const { isConnectMerchantReady, isConnectPayoutReady, isStripeConfigured } =
        await import('@/lib/stripe');

      const RECONCILE_LIMIT = 50;
      let promoted = 0;
      let stillPending = 0;

      if (isStripeConfigured()) {
        const pending = await db.profile.findMany({
          where: { stripeConnectOnboarded: false, stripeConnectAccountId: { not: null } },
          select: { id: true, type: true, stripeConnectAccountId: true },
          orderBy: { updatedAt: 'asc' },
          take: RECONCILE_LIMIT,
        });

        for (const profile of pending) {
          const accountId = profile.stripeConnectAccountId;
          if (!accountId) continue;
          /* A VENUE has to clear both. It is the merchant on its own shows, and
             `card_payments` is what makes that true; marking it onboarded on
             the payout capability alone lights up "Verified" for an account
             that cannot take a charge. Same rule as the return route. */
          const payoutReady = await isConnectPayoutReady(accountId).catch(() => false);
          const merchantReady =
            profile.type === 'VENUE'
              ? await isConnectMerchantReady(accountId).catch(() => false)
              : true;
          if (payoutReady && merchantReady) {
            await db.profile.update({
              where: { id: profile.id },
              data: { stripeConnectOnboarded: true },
            });
            promoted += 1;
          } else {
            stillPending += 1;
          }
        }
      }

      /* Only genuinely CORRUPT state is worth an email now. "Started
         onboarding and has not finished" is the ordinary condition of every
         member mid-signup, and this alert used to include it — so it fired
         every six hours about people doing nothing wrong, which is how an
         alert becomes something nobody reads. An onboarded profile with no
         account id cannot happen through any code path and means the two
         columns have diverged. */
      const corrupt = await db.profile.findMany({
        where: { stripeConnectOnboarded: true, stripeConnectAccountId: null },
        select: { name: true, slug: true },
      });
      if (corrupt.length > 0) {
        const line = (i: { name: string; slug: string }) =>
          `${i.name} (${i.slug}): marked onboarded with no Connect account id`;
        await sendOperationalEmail(
          {
            to: getAdminAlertRecipients(),
            subject: `[iHYPE] Stripe Connect state is inconsistent (${corrupt.length})`,
            text: corrupt.map(line).join('\n'),
            html: `<p>${corrupt.map((i) => `<strong>${i.name}</strong> (${i.slug}): marked onboarded with no Connect account id`).join('<br/>')}</p>`,
          },
          'stripe-connect-health',
        );
      }

      await pingCronAlive('stripe-connect-health');
      return NextResponse.json({ ok: true, promoted, stillPending, corrupt: corrupt.length });
    }

    default:
      return NextResponse.json({ error: 'Unknown job.' }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}

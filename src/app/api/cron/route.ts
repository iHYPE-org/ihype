import { NextRequest, NextResponse } from 'next/server';
import { isCronRequestAuthorized } from '@/lib/cron-auth';
import { ADMIN_EMAIL } from '@/lib/env';
import { pingCronAlive, WEEKLY_TTL } from '@/lib/cron-health';

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
        where: { type: { in: ['ARTIST', 'DJ'] } },
        select: { id: true, name: true, owner: { select: { id: true, email: true, name: true } } }
      });
      const { sent } = await sendArtistWeeklyDigestBatch(profiles);
      return NextResponse.json({ ok: true, sent });
    }

    case 'health-check': {
      const { getHealthSnapshot } = await import('@/lib/health');
      const { isEmailDeliveryConfigured, sendGenericEmail } = await import('@/lib/mailer');
      const { checkCronHealth } = await import('@/lib/cron-health');
      const snapshot = await getHealthSnapshot();
      if (snapshot.status !== 'ok' && isEmailDeliveryConfigured()) {
        try {
          const summary = JSON.stringify(snapshot, null, 2);
          await sendGenericEmail({
            to: ADMIN_EMAIL,
            subject: '[iHYPE] Health check failure',
            text: `iHYPE health check returned non-ok status.\n\n${summary}`,
            html: `<p>iHYPE health check returned non-ok status.</p><pre style="font-family:monospace;font-size:12px;background:#0a0805;color:#f0ebe5;padding:12px;border-radius:6px;white-space:pre-wrap;">${summary.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</pre>`
          });
        } catch (err) {
          console.error('[cron/health-check] alert email failed', err);
        }
      }
      if (snapshot.status === 'ok' && !snapshot.launchReadiness.ready && isEmailDeliveryConfigured()) {
        try {
          const { kvGet, kvPut } = await import('@/lib/kv');
          const lastAlert = await kvGet<number>('health-alert:launch-readiness');
          const shouldAlert = !lastAlert || Date.now() - lastAlert > 24 * 60 * 60 * 1000;
          if (shouldAlert) {
            await sendGenericEmail({
              to: ADMIN_EMAIL,
              subject: '[iHYPE] Launch readiness blockers',
              text: snapshot.launchReadiness.blockers.join('\n'),
              html: `<ul>${snapshot.launchReadiness.blockers.map((item) => `<li>${item}</li>`).join('')}</ul>`
            });
            await kvPut('health-alert:launch-readiness', Date.now(), { ex: 24 * 60 * 60 });
          }
        } catch (err) {
          console.error('[cron/health-check] launch readiness alert failed', err);
        }
      }
      const cronHealth = await checkCronHealth();
      if (cronHealth.stale.length > 0) {
        try {
          const { kvGet, kvPut } = await import('@/lib/kv');
          const lastCronAlert = await kvGet<number>('health-alert:stale-crons');
          const shouldAlert = !lastCronAlert || Date.now() - lastCronAlert > 24 * 60 * 60 * 1000;
          if (shouldAlert) {
            await sendGenericEmail({ to: ADMIN_EMAIL, subject: '[iHYPE] Stale cron jobs detected', text: `These cron jobs haven't run in their expected window: ${cronHealth.stale.join(', ')}`, html: `<p>Stale crons: <strong>${cronHealth.stale.join(', ')}</strong></p>` }).catch(() => {});
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
      const { sendGenericEmail } = await import('@/lib/mailer');
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
        await sendGenericEmail({ to: ADMIN_EMAIL, subject: '[iHYPE] DB health alert', text: alerts.join('\n\n') + `\n\nCurrent counts: users=${userCount}, profiles=${profileCount}`, html: `<p>${alerts.map(a => `<strong>${a}</strong>`).join('<br/><br/>')}</p>` }).catch(() => {});
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
      const { db } = await import('@/lib/db');
      const { sendGenericEmail } = await import('@/lib/mailer');
      const issues = await db.profile.findMany({
        where: {
          OR: [
            { stripeConnectOnboarded: true, stripeConnectAccountId: null },
            { stripeConnectOnboarded: false, stripeConnectAccountId: { not: null } }
          ]
        },
        select: { name: true, slug: true, stripeConnectOnboarded: true, stripeConnectAccountId: true }
      });
      if (issues.length > 0) {
        await sendGenericEmail({ to: ADMIN_EMAIL, subject: `[iHYPE] Stripe Connect issues (${issues.length})`, text: issues.map(i => `${i.name}: onboarded=${i.stripeConnectOnboarded}, accountId=${i.stripeConnectAccountId ?? 'null'}`).join('\n'), html: `<p>${issues.map(i => `<strong>${i.name}</strong>: onboarded=${i.stripeConnectOnboarded}, accountId=${i.stripeConnectAccountId ?? 'null'}`).join('<br/>')}</p>` }).catch(() => {});
      }
      await pingCronAlive('stripe-connect-health');
      return NextResponse.json({ ok: true, issues: issues.length });
    }

    case 'scene-wrapped': {
      // Month-end re-engagement: nudge users who were active this month that
      // their shareable Scene Wrapped card is ready. Deduped to once per user
      // per calendar month via the WRAPPED_READY notification.
      const { db } = await import('@/lib/db');
      const { notifyUser } = await import('@/lib/notify');
      const now = new Date();
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

      const activeUserRows = await db.profileHypeEvent.findMany({
        where: { createdAt: { gte: monthStart } },
        select: { userId: true },
        distinct: ['userId'],
        take: 5000,
      });

      let notified = 0;
      for (const { userId } of activeUserRows) {
        const already = await db.notification.findFirst({
          where: { userId, type: 'WRAPPED_READY', createdAt: { gte: monthStart } },
          select: { id: true },
        });
        if (already) continue;
        await notifyUser(userId, {
          type: 'WRAPPED_READY',
          title: 'Your month in the scene',
          body: 'Your Scene Wrapped is ready — see your shows, hypes, and discoveries.',
          link: '/me/wrapped',
        });
        notified++;
      }
      await pingCronAlive('scene-wrapped', WEEKLY_TTL);
      return NextResponse.json({ ok: true, notified });
    }

    default:
      return NextResponse.json({ error: 'Unknown job.' }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}

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
        select: { id: true, name: true, owner: { select: { email: true, name: true } } }
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
        await sendGenericEmail({ to: ADMIN_EMAIL, subject: '[iHYPE] Stale cron jobs detected', text: `These cron jobs haven't run in 48h: ${cronHealth.stale.join(', ')}`, html: `<p>Stale crons: <strong>${cronHealth.stale.join(', ')}</strong></p>` }).catch(() => {});
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
      await pingCronAlive('weekly-picks');
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

    case 'expire-ads': {
      const { db } = await import('@/lib/db');
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const result = await db.adSubmission.updateMany({
        where: { status: 'pending', createdAt: { lt: cutoff } },
        data: { status: 'expired' }
      });
      return NextResponse.json({ ok: true, expired: result.count });
    }

    case 'feature-shows': {
      const { db } = await import('@/lib/db');
      // Find shows with high hype in last 24h
      const hotShows = await db.show.findMany({
        where: { status: 'SCHEDULED', startsAt: { gte: new Date() } },
        select: { id: true, hypeCount: true, tags: true },
        orderBy: { hypeCount: 'desc' },
        take: 5
      });
      let updated = 0;
      for (const show of hotShows) {
        if (!show.tags.includes('featured')) {
          await db.show.update({ where: { id: show.id }, data: { tags: { push: 'featured' } } });
          updated++;
        }
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
      let flagged = 0;
      for (const user of stale) {
        const existing = await db.auditLog.findFirst({ where: { actorUserId: null, action: 'SPAM_FLAGGED', entityId: user.id } });
        if (!existing) {
          await db.auditLog.create({ data: { actorUserId: null, action: 'SPAM_FLAGGED', entityType: 'User', entityId: user.id, metadata: {} } });
          flagged++;
        }
      }
      return NextResponse.json({ ok: true, flagged });
    }

    case 'show-payouts': {
      const { triggerShowPayouts } = await import('@/lib/show-payouts');
      const result = await triggerShowPayouts();
      await pingCronAlive('show-payouts');
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

    default:
      return NextResponse.json({ error: 'Unknown job.' }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}

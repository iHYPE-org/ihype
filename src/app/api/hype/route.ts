import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { recordAuditEvent } from '@/lib/audit';
import { db } from '@/lib/db';
import { z } from 'zod';
import { consumeRateLimit, rateLimitHeaders, rateLimitKey } from '@/lib/rate-limit';
import { sendGenericEmail } from '@/lib/mailer';
import { checkAndAwardBadges } from '@/lib/badges';
import { getBaseUrl } from '@/lib/utils';
import { sendPushNotification } from '@/lib/push-notify';

const HYPE_MILESTONES = [10, 50, 100, 500, 1000];

async function checkAndRecordMilestone(profileId: string, newCount: number) {
  const crossed = HYPE_MILESTONES.find((m) => newCount === m);
  if (!crossed) return;
  try {
    // Guard: don't re-fire if this milestone was already recorded (e.g. after unhype + rehype).
    const alreadyRecorded = await db.auditLog.findFirst({
      where: { action: `profile_milestone_hype_${crossed}`, entityId: profileId },
      select: { id: true }
    });
    if (alreadyRecorded) return;

    const profile = await db.profile.findUnique({
      where: { id: profileId },
      select: { id: true, name: true, slug: true, type: true, owner: { select: { email: true, name: true } } }
    });
    if (!profile) return;
    const base = getBaseUrl();
    const cardUrl = `${base}/api/milestones/${profileId}/card?milestone=${encodeURIComponent(`${crossed} HYPES`)}`;
    await recordAuditEvent({
      action: `profile_milestone_hype_${crossed}`,
      entityType: 'profile',
      entityId: profileId,
      metadata: { milestone: crossed, profileName: profile.name, cardUrl }
    });
    const ownerEmail = profile.owner?.email;
    if (ownerEmail) {
      const ownerName = profile.owner?.name?.trim() || profile.name;
      const text = [
        `Congrats ${ownerName}!`,
        '',
        `${profile.name} just crossed ${crossed} hypes on iHYPE.`,
        'Keep the momentum — share your profile to invite more fans.',
        '',
        '— iHYPE'
      ].join('\n');
      const html = `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#10182a;">
          <h2 style="margin:0 0 12px;">🎉 ${crossed} hypes!</h2>
          <p>Congrats ${ownerName} — <strong>${profile.name}</strong> just crossed <strong>${crossed} hypes</strong> on iHYPE.</p>
          <p>Keep the momentum — share your profile to invite more fans.</p>
          <p style="color:#5b657a;font-size:12px;">— iHYPE</p>
        </div>
      `;
      await sendGenericEmail({
        to: ownerEmail,
        subject: `🎉 ${profile.name} just hit ${crossed} hypes`,
        text,
        html
      }).catch(() => {});
    }
  } catch {
    // Milestones are best-effort; never fail the hype call.
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const showId = searchParams.get('showId');
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '10'), 50);
  if (!showId) return NextResponse.json({ error: 'showId required' }, { status: 400 });
  const hypers = await db.hypeEvent.findMany({
    where: { showId },
    orderBy: { createdAt: 'asc' },
    take: limit,
    include: { user: { select: { id: true, username: true, image: true } } },
  });
  const total = await db.hypeEvent.count({ where: { showId } });
  return NextResponse.json({
    hypers: hypers.map((h, i) => ({
      userId: h.userId,
      username: h.user.username,
      avatarUrl: h.user.image,
      isFirst: i === 0,
    })),
    total,
  });
}

const schema = z.discriminatedUnion('targetType', [
  z.object({ targetType: z.literal('show'), targetId: z.string().cuid() }),
  z.object({ targetType: z.literal('profile'), targetId: z.string().cuid() })
]);

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Login required' }, { status: 401 });
  }

  // 30 hype actions per minute per user — prevents scripted spam
  const rl = await consumeRateLimit(
    rateLimitKey('hype', session.user.id, request.headers.get('x-forwarded-for')),
    { limit: 30, windowMs: 60_000 }
  );
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many hype requests. Slow down.' },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  try {
    const payload = schema.parse(await request.json());

    if (payload.targetType === 'show') {
      const existing = await db.hypeEvent.findUnique({
        where: { userId_showId: { userId: session.user.id, showId: payload.targetId } }
      });

      if (existing) {
        // Toggle off: unhype the show.
        const [, updatedShow] = await db.$transaction([
          db.hypeEvent.delete({ where: { userId_showId: { userId: session.user.id, showId: payload.targetId } } }),
          db.show.update({ where: { id: payload.targetId }, data: { hypeCount: { decrement: 1 } } })
        ]);
        return NextResponse.json({ action: 'unhyped', hypeCount: Math.max(0, updatedShow.hypeCount) });
      }

      const [, updatedShow] = await db.$transaction([
        db.hypeEvent.create({ data: { userId: session.user.id, showId: payload.targetId } }),
        db.show.update({ where: { id: payload.targetId }, data: { hypeCount: { increment: 1 } } })
      ]);

      await recordAuditEvent({
        actorUserId: session.user.id,
        action: 'show_hyped',
        entityType: 'show',
        entityId: payload.targetId
      });

      // Spam detection: flag if user exceeds 100 hype actions in 60 seconds
      const recentShowHypeCount = await db.hypeEvent.count({
        where: { userId: session.user.id, createdAt: { gte: new Date(Date.now() - 60_000) } }
      });
      if (recentShowHypeCount > 100) {
        const admins = await db.user.findMany({ where: { role: 'ADMIN' }, select: { id: true }, take: 1 });
        if (admins[0]) {
          await db.notification.create({
            data: {
              userId: admins[0].id,
              type: 'SPAM_FLAG',
              body: `User ${session.user.id} sent ${recentShowHypeCount} show hypes in 60s`,
              link: `/admin`
            }
          });
        }
        return NextResponse.json({ error: 'Spam detected' }, { status: 429 });
      }

      return NextResponse.json({ action: 'hyped', hypeCount: updatedShow.hypeCount });
    }

    // Profile hype — toggle on/off
    const existing = await db.profileHypeEvent.findUnique({
      where: { userId_profileId: { userId: session.user.id, profileId: payload.targetId } }
    });

    if (existing) {
      // Toggle off: unhype the profile.
      const [, updatedProfile] = await db.$transaction([
        db.profileHypeEvent.delete({ where: { userId_profileId: { userId: session.user.id, profileId: payload.targetId } } }),
        db.profile.update({ where: { id: payload.targetId }, data: { hypeCount: { decrement: 1 } } })
      ]);
      await recordAuditEvent({
        actorUserId: session.user.id,
        action: 'profile_unhyped',
        entityType: 'profile',
        entityId: payload.targetId
      });
      return NextResponse.json({ action: 'unhyped', hypeCount: Math.max(0, updatedProfile.hypeCount) });
    }

    const [, updatedProfile] = await db.$transaction([
      db.profileHypeEvent.create({ data: { userId: session.user.id, profileId: payload.targetId } }),
      db.profile.update({ where: { id: payload.targetId }, data: { hypeCount: { increment: 1 } } })
    ]);

    await recordAuditEvent({
      actorUserId: session.user.id,
      action: 'profile_hyped',
      entityType: 'profile',
      entityId: payload.targetId
    });

    await checkAndRecordMilestone(payload.targetId, updatedProfile.hypeCount);
    checkAndAwardBadges(session.user.id).catch(() => {});

    // Push notification to track owner (fire-and-forget, skip self-hype)
    db.profile.findUnique({ where: { id: payload.targetId }, select: { ownerId: true, name: true } })
      .then(profile => {
        if (profile && profile.ownerId !== session.user.id) {
          sendPushNotification(profile.ownerId, {
            title: 'Your track got hyped!',
            body: `Someone just hyped ${profile.name} on iHYPE.`,
          }).catch(() => {});
        }
      })
      .catch(() => {});

    return NextResponse.json({ action: 'hyped', hypeCount: updatedProfile.hypeCount });
  } catch (err) {
    console.error('[hype]', err);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

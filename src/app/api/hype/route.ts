import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { recordAuditEvent } from '@/lib/audit';
import { db, withDbRetry } from '@/lib/db';
import { z } from 'zod';
import { consumeRateLimit, rateLimitHeaders, rateLimitKey } from '@/lib/rate-limit';
import { sendGenericEmail } from '@/lib/mailer';
import { checkAndAwardBadges } from '@/lib/badges';
import { getBaseUrl } from '@/lib/utils';
import { notifyUser, sendPushToAllDevices } from '@/lib/notify';
import { log } from '@/lib/logger';
import { applyHypeEntry, InsufficientHypeError } from '@/lib/hype-ledger';
import { formatHypeWait, hypeWaitMs, nextHypeAt } from '@/lib/hype-window';
import { escapeHtml } from '@/lib/html-escape';

const HYPE_MILESTONES = [10, 50, 100, 500, 1000];
const SHOW_HYPE_MILESTONES = [10, 25, 50, 100, 250, 500];

async function checkAndRecordShowMilestone(showId: string, newCount: number) {
  const crossed = SHOW_HYPE_MILESTONES.find((m) => newCount === m);
  if (!crossed) return;
  try {
    // Guard: don't re-fire if this milestone was already recorded (e.g. after unhype + rehype).
    const alreadyRecorded = await db.auditLog.findFirst({
      where: { action: `show_milestone_hype_${crossed}`, entityId: showId },
      select: { id: true }
    });
    if (alreadyRecorded) return;

    const show = await db.show.findUnique({
      where: { id: showId },
      select: { id: true, title: true, creator: { select: { email: true, name: true } } }
    });
    if (!show) return;
    await recordAuditEvent({
      action: `show_milestone_hype_${crossed}`,
      entityType: 'show',
      entityId: showId,
      metadata: { milestone: crossed, showTitle: show.title }
    });
    const ownerEmail = show.creator?.email;
    if (ownerEmail) {
      const ownerName = show.creator?.name?.trim() || show.title;
      const text = [
        `Congrats ${ownerName}!`,
        '',
        `Your show '${show.title}' just hit ${crossed} hypes on iHYPE.`,
        'Keep the momentum — share your show to invite more fans.',
        '',
        '— iHYPE'
      ].join('\n');
      const html = `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#10182a;">
          <h2 style="margin:0 0 12px;">🎉 ${crossed} hypes!</h2>
          <p>Congrats ${escapeHtml(ownerName)} — <strong>${escapeHtml(show.title)}</strong> just hit <strong>${crossed} hypes</strong> on iHYPE.</p>
          <p>Keep the momentum — share your show to invite more fans.</p>
          <p style="color:#5b657a;font-size:12px;">— iHYPE</p>
        </div>
      `;
      await sendGenericEmail({
        to: ownerEmail,
        subject: `🎉 Your show '${show.title}' just hit ${crossed} hypes`,
        text,
        html
      }).catch(() => {});
    }
  } catch {
    // Milestones are best-effort; never fail the hype call.
  }
}

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
          <p>Congrats ${escapeHtml(ownerName)} — <strong>${escapeHtml(profile.name)}</strong> just crossed <strong>${crossed} hypes</strong> on iHYPE.</p>
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
  const parsedLimit = parseInt(searchParams.get('limit') ?? '10', 10);
  const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 50) : 10;
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
  z.object({
    targetType: z.literal('show'),
    targetId: z.string().cuid(),
    positionSeconds: z.number().int().nonnegative().max(86_400).optional()
  }),
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

  // Global circuit breaker — if >500 hype events in the last 5 seconds, shed load
  const last5s = new Date(Date.now() - 5000);
  const globalBurst = await db.hypeEvent.count({ where: { createdAt: { gte: last5s } } });
  if (globalBurst > 500) {
    return NextResponse.json({ error: 'Service busy, try again shortly.' }, { status: 503 });
  }

  try {
    const payload = schema.parse(await request.json());

    if (payload.targetType === 'show') {
      const targetShow = await db.show.findFirst({
        where: {
          id: payload.targetId,
          moderationStatus: 'APPROVED',
          status: { in: ['SCHEDULED', 'LIVE', 'ENDED'] },
        },
        select: { creatorId: true },
      });
      if (!targetShow) {
        return NextResponse.json({ error: 'Published show not found' }, { status: 404 });
      }
      if (targetShow.creatorId === session.user.id) {
        return NextResponse.json({ error: 'You cannot HYPE your own show.' }, { status: 409 });
      }
      const existing = await withDbRetry(() => db.hypeEvent.findUnique({
        where: { userId_showId: { userId: session.user.id, showId: payload.targetId } }
      }));

      // Inside the 24h window this tap is refused rather than toggled off. The
      // button states the remaining wait, so reaching this is a stale page or
      // a scripted call — either way the answer is when, not no.
      const showWait = hypeWaitMs(existing?.createdAt);
      if (showWait > 0) {
        return NextResponse.json(
          {
            error: `You already hyped this show. You can hype it again in ${formatHypeWait(showWait)}.`,
            code: 'HYPE_WINDOW_OPEN',
            nextHypeAt: nextHypeAt(existing?.createdAt)?.toISOString(),
            retryAfterMs: showWait,
          },
          { status: 429, headers: { 'Retry-After': String(Math.ceil(showWait / 1000)) } },
        );
      }

      const result = await withDbRetry(() => db.$transaction(async (tx) => {
        // Replaced, not updated: the row IS the current hype, so `createdAt`
        // keeps meaning "when this hype was given" and the new row's id gives
        // the ledger spend a genuinely new idempotency key. Updating in place
        // would reuse `show-hype:<id>`, and the ledger would swallow every
        // repeat spend as a duplicate — a free hype, every day, forever.
        if (existing) {
          await tx.hypeEvent.delete({
            where: { userId_showId: { userId: session.user.id, showId: payload.targetId } },
          });
        }
        const hype = await tx.hypeEvent.create({
          data: { userId: session.user.id, showId: payload.targetId, positionSeconds: payload.positionSeconds }
        });
        const spend = await applyHypeEntry(tx, {
          userId: session.user.id,
          amount: -1,
          source: 'HYPE_GIVEN',
          idempotencyKey: `show-hype:${hype.id}`,
          targetType: 'show',
          targetId: payload.targetId,
        });
        const updatedShow = await tx.show.update({
          where: { id: payload.targetId },
          data: { hypeCount: { increment: 1 } },
        });
        return { updatedShow, balance: spend.entry?.balanceAfter };
      }));
      const updatedShow = result.updatedShow;

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

      checkAndRecordShowMilestone(payload.targetId, updatedShow.hypeCount).catch(() => {});
      checkAndAwardBadges(session.user.id).catch(() => {});

      // Push notification to show creator (fire-and-forget, skip self-hype)
      db.show.findUnique({ where: { id: payload.targetId }, select: { creatorId: true, title: true } })
        .then(show => {
          if (show && show.creatorId !== session.user.id) {
            sendPushToAllDevices(show.creatorId, {
              title: 'Your show got hyped!',
              body: `Someone just hyped '${show.title}' on iHYPE.`,
            }).catch(() => {});
          }
        })
        .catch(() => {});

      return NextResponse.json({
        action: 'hyped',
        hypeCount: updatedShow.hypeCount,
        hypeBalance: result.balance,
        nextHypeAt: nextHypeAt(new Date())?.toISOString(),
      });
    }

    // Profile hype — toggle on/off
    const targetProfile = await db.profile.findFirst({
      where: { id: payload.targetId, discoverable: true },
      select: { ownerId: true },
    });
    if (!targetProfile) {
      return NextResponse.json({ error: 'Public profile not found' }, { status: 404 });
    }
    if (targetProfile.ownerId === session.user.id) {
      return NextResponse.json({ error: 'You cannot HYPE your own profile.' }, { status: 409 });
    }
    const existing = await db.profileHypeEvent.findUnique({
      where: { userId_profileId: { userId: session.user.id, profileId: payload.targetId } }
    });

    const profileWait = hypeWaitMs(existing?.createdAt);
    if (profileWait > 0) {
      return NextResponse.json(
        {
          error: `You already hyped this. You can hype it again in ${formatHypeWait(profileWait)}.`,
          code: 'HYPE_WINDOW_OPEN',
          nextHypeAt: nextHypeAt(existing?.createdAt)?.toISOString(),
          retryAfterMs: profileWait,
        },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(profileWait / 1000)) } },
      );
    }
    const isFirstHype = !existing;

    const result = await db.$transaction(async (tx) => {
      // See the note in the show branch: replaced, not updated.
      if (existing) {
        await tx.profileHypeEvent.delete({
          where: { userId_profileId: { userId: session.user.id, profileId: payload.targetId } },
        });
      }
      const hype = await tx.profileHypeEvent.create({
        data: { userId: session.user.id, profileId: payload.targetId },
      });
      const spend = await applyHypeEntry(tx, {
        userId: session.user.id,
        amount: -1,
        source: 'HYPE_GIVEN',
        idempotencyKey: `profile-hype:${hype.id}`,
        targetType: 'profile',
        targetId: payload.targetId,
      });
      const updatedProfile = await tx.profile.update({
        where: { id: payload.targetId },
        data: { hypeCount: { increment: 1 } },
      });
      return { updatedProfile, balance: spend.entry?.balanceAfter };
    });
    const updatedProfile = result.updatedProfile;

    await recordAuditEvent({
      actorUserId: session.user.id,
      action: 'profile_hyped',
      entityType: 'profile',
      entityId: payload.targetId
    });

    await checkAndRecordMilestone(payload.targetId, updatedProfile.hypeCount);
    checkAndAwardBadges(session.user.id).catch(() => {});

    // Early-believer re-engagement. `hypeCount` is a running total and stopped
    // being a headcount the day HYPE started resetting every 24h — one member
    // hyping daily used to be indistinguishable from a hundred members hyping
    // once. Rank comes from the believer ROWS instead, which are still one per
    // member (unique on user+profile), and only a first-time believer has a
    // rank to be told about.
    if (isFirstHype) {
      const rank = await db.profileHypeEvent
        .count({ where: { profileId: payload.targetId } })
        .catch(() => 0);
      if (rank > 0 && rank <= 25) {
      db.profile.findUnique({ where: { id: payload.targetId }, select: { slug: true, name: true, type: true } })
        .then((p: { slug: string; name: string; type: string } | null) => {
          if (p && p.type === 'ARTIST') {
            notifyUser(session.user.id, {
              type: 'EARLY_BELIEVER',
              title: 'You called it early',
              body: `You're early believer #${rank} in ${p.name}.`,
              link: `/artists/${p.slug}/believers`,
            }).catch(() => {});
          }
        })
        .catch(() => {});
      }
    }

    // Push notification to track owner (fire-and-forget, skip self-hype)
    db.profile.findUnique({ where: { id: payload.targetId }, select: { ownerId: true, name: true } })
      .then(profile => {
        if (profile && profile.ownerId !== session.user.id) {
          sendPushToAllDevices(profile.ownerId, {
            title: 'Your track got hyped!',
            body: `Someone just hyped ${profile.name} on iHYPE.`,
          }).catch(() => {});
        }
      })
      .catch(() => {});

    return NextResponse.json({
      action: 'hyped',
      hypeCount: updatedProfile.hypeCount,
      hypeBalance: result.balance,
      nextHypeAt: nextHypeAt(new Date())?.toISOString(),
    });
  } catch (err) {
    if (err instanceof InsufficientHypeError) {
      return NextResponse.json({ error: err.message, code: 'INSUFFICIENT_HYPE' }, { status: 409 });
    }
    log.error('[hype]', err instanceof Error ? err : { error: String(err) });
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

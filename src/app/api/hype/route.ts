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

const schema = z.discriminatedUnion('targetType', [
  z.object({
    targetType: z.literal('show'),
    targetId: z.string().cuid(),
    positionSeconds: z.number().int().nonnegative().max(86_400).optional()
  }),
  /* A profile is named by id (the artist page, which holds one) OR by slug
     (the full player, whose queue rows carry `artistProfileSlug` and nothing
     else — every station, chart, playlist and deck writer stores the slug, so
     asking each of them for an id would be five more writers to keep in
     step). Exactly one of the two; the handler checks, because a `.refine`
     would make this a ZodEffects and the discriminated union refuses those. */
  z.object({ targetType: z.literal('profile'), targetId: z.string().cuid().optional(), slug: z.string().trim().min(1).max(120).optional() })
]);

/**
 * The profile a hype would land on, resolved the way the layout resolves the
 * last listen's: everything the POST refuses is answered here first, so a
 * control is never drawn that is guaranteed to fail. `hypeable` is false for
 * a profile that does not exist, one that is not discoverable, and the
 * viewer's own; `hyped` and `nextHypeAt` describe the viewer's window on it.
 */
async function resolveHypeTarget(userId: string, by: { id?: string; slug?: string }) {
  const profile = await db.profile.findFirst({
    where: { ...(by.id ? { id: by.id } : { slug: by.slug }), discoverable: true },
    select: { id: true, ownerId: true },
  });
  if (!profile) return { hypeable: false as const, profileId: null, reason: 'not_found' as const };
  if (profile.ownerId === userId) return { hypeable: false as const, profileId: profile.id, reason: 'own' as const };
  const existing = await db.profileHypeEvent.findUnique({
    where: { userId_profileId: { userId, profileId: profile.id } },
    select: { createdAt: true },
  });
  const wait = hypeWaitMs(existing?.createdAt);
  return {
    hypeable: true as const,
    profileId: profile.id,
    reason: null,
    hyped: wait > 0,
    nextHypeAt: wait > 0 ? nextHypeAt(existing?.createdAt)?.toISOString() ?? null : null,
  };
}

/**
 * GET /api/hype?targetType=profile&slug=<slug>  (or &targetId=<cuid>)
 *
 * The full player's HYPE state for the artist of the track that is PLAYING.
 * Until 2026-09-22 the shell knew the hype state of exactly one artist — the
 * viewer's last listen, resolved server-side by the /app layout — and gated
 * the full player's HYPE on NO track being loaded, while the player itself
 * can only be opened from the pill, which exists only WITH a track loaded.
 * So the control could never render. The player asks here for whatever is
 * in the audio element now; the answer is private to the viewer.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Login required' }, { status: 401 });
  }
  const params = request.nextUrl.searchParams;
  if (params.get('targetType') !== 'profile') {
    return NextResponse.json({ error: 'targetType must be profile' }, { status: 400 });
  }
  const id = params.get('targetId')?.trim() || undefined;
  const slug = params.get('slug')?.trim() || undefined;
  if ((id ? 1 : 0) + (slug ? 1 : 0) !== 1 || (id && !z.string().cuid().safeParse(id).success) || (slug && slug.length > 120)) {
    return NextResponse.json({ error: 'Name the profile by targetId or slug' }, { status: 400 });
  }
  try {
    const target = await resolveHypeTarget(session.user.id, { id, slug });
    return NextResponse.json(
      target.hypeable
        ? { hypeable: true, profileId: target.profileId, hyped: target.hyped, nextHypeAt: target.nextHypeAt }
        : { hypeable: false, profileId: target.profileId, reason: target.reason, hyped: false, nextHypeAt: null },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (err) {
    log.error('[hype] status', err instanceof Error ? err : { error: String(err) });
    return NextResponse.json({ error: 'Could not read the hype state' }, { status: 503, headers: { 'Retry-After': '10' } });
  }
}

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

    // Profile hype — once per 24h window, by id or by slug (see `schema`).
    if ((payload.targetId ? 1 : 0) + (payload.slug ? 1 : 0) !== 1) {
      return NextResponse.json({ error: 'Name the profile by targetId or slug' }, { status: 400 });
    }
    const targetProfile = await db.profile.findFirst({
      where: { ...(payload.targetId ? { id: payload.targetId } : { slug: payload.slug }), discoverable: true },
      select: { id: true, ownerId: true },
    });
    if (!targetProfile) {
      return NextResponse.json({ error: 'Public profile not found' }, { status: 404 });
    }
    if (targetProfile.ownerId === session.user.id) {
      return NextResponse.json({ error: 'You cannot HYPE your own profile.' }, { status: 409 });
    }
    const profileId = targetProfile.id;
    const existing = await db.profileHypeEvent.findUnique({
      where: { userId_profileId: { userId: session.user.id, profileId } }
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
          where: { userId_profileId: { userId: session.user.id, profileId: profileId } },
        });
      }
      const hype = await tx.profileHypeEvent.create({
        data: { userId: session.user.id, profileId: profileId },
      });
      const spend = await applyHypeEntry(tx, {
        userId: session.user.id,
        amount: -1,
        source: 'HYPE_GIVEN',
        idempotencyKey: `profile-hype:${hype.id}`,
        targetType: 'profile',
        targetId: profileId,
      });
      const updatedProfile = await tx.profile.update({
        where: { id: profileId },
        data: { hypeCount: { increment: 1 } },
      });
      return { updatedProfile, balance: spend.entry?.balanceAfter };
    });
    const updatedProfile = result.updatedProfile;

    await recordAuditEvent({
      actorUserId: session.user.id,
      action: 'profile_hyped',
      entityType: 'profile',
      entityId: profileId
    });

    await checkAndRecordMilestone(profileId, updatedProfile.hypeCount);
    checkAndAwardBadges(session.user.id).catch(() => {});

    // Early-believer re-engagement. `hypeCount` is a running total and stopped
    // being a headcount the day HYPE started resetting every 24h — one member
    // hyping daily used to be indistinguishable from a hundred members hyping
    // once. Rank comes from the believer ROWS instead, which are still one per
    // member (unique on user+profile), and only a first-time believer has a
    // rank to be told about.
    if (isFirstHype) {
      const rank = await db.profileHypeEvent
        .count({ where: { profileId: profileId } })
        .catch(() => 0);
      if (rank > 0 && rank <= 25) {
      db.profile.findUnique({ where: { id: profileId }, select: { slug: true, name: true, type: true } })
        .then((p: { slug: string; name: string; type: string } | null) => {
          if (p && p.type === 'ARTIST') {
            notifyUser(session.user.id, {
              type: 'EARLY_BELIEVER',
              title: 'You called it early',
              body: `You're early believer #${rank} in ${p.name}.`,
              link: `/app/me/artists/${p.slug}/believers`,
            }).catch(() => {});
          }
        })
        .catch(() => {});
      }
    }

    // Push notification to track owner (fire-and-forget, skip self-hype)
    db.profile.findUnique({ where: { id: profileId }, select: { ownerId: true, name: true } })
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
      profileId,
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

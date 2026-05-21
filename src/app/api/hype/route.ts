import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { recordAuditEvent } from '@/lib/audit';
import { db } from '@/lib/db';
import { z } from 'zod';
import { consumeRateLimit, rateLimitHeaders, rateLimitKey } from '@/lib/rate-limit';
import { sendGenericEmail } from '@/lib/mailer';
import { checkAndAwardBadges } from '@/lib/badges';
import { getBaseUrl } from '@/lib/utils';

const HYPE_MILESTONES = [10, 50, 100, 500, 1000];

async function checkAndRecordMilestone(profileId: string, newCount: number) {
  const crossed = HYPE_MILESTONES.find((m) => newCount === m);
  if (!crossed) return;
  try {
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
        const show = await db.show.findUniqueOrThrow({ where: { id: payload.targetId } });
        return NextResponse.json({ created: false, hypeCount: show.hypeCount });
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

      return NextResponse.json({ created: true, hypeCount: updatedShow.hypeCount });
    }

    const existing = await db.profileHypeEvent.findUnique({
      where: { userId_profileId: { userId: session.user.id, profileId: payload.targetId } }
    });

    if (existing) {
      const profile = await db.profile.findUniqueOrThrow({ where: { id: payload.targetId } });
      return NextResponse.json({ created: false, hypeCount: profile.hypeCount });
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

    return NextResponse.json({ created: true, hypeCount: updatedProfile.hypeCount });
  } catch (err) {
    console.error('[hype]', err);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

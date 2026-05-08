import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { recordAuditEvent } from '@/lib/audit';
import { db } from '@/lib/db';
import { z } from 'zod';
import { consumeRateLimit, rateLimitHeaders, rateLimitKey } from '@/lib/rate-limit';

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

    return NextResponse.json({ created: true, hypeCount: updatedProfile.hypeCount });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { log } from '@/lib/logger';
import { consumeRateLimit } from '@/lib/rate-limit';

/**
 * Likes — one per user per thing, held until unliked.
 *
 * Owner (2026-08-24): "Only like a track/album/artist/venue/advertisement
 * once, stored to user's account. Likes are saved to account until unliked."
 *
 * TRACK likes deliberately stay in `/api/fan-favorites` (FanFavoriteMedia):
 * the player needs the stored URL/title/artwork to make a liked track
 * playable, and a bare (type, id) pair cannot carry that. This route covers
 * the targets that only need identity — ALBUM, ARTIST, VENUE, ADVERTISEMENT —
 * with the "only once" rule enforced by the schema's unique constraint, not
 * by the client: a repeated POST upserts onto the same row.
 *
 * Any signed-in account may like. Likes are a listener act, not a role
 * feature — an artist liking a venue is exactly the graph the product wants.
 */
const likeSchema = z.object({
  targetType: z.enum(['ALBUM', 'ARTIST', 'VENUE', 'ADVERTISEMENT']),
  targetId: z.string().trim().min(1).max(64),
});

/** The target must exist in its own table, or junk ids accrete rows forever. */
async function targetExists(targetType: z.infer<typeof likeSchema>['targetType'], targetId: string) {
  switch (targetType) {
    case 'ARTIST': {
      const profile = await db.profile.findUnique({ where: { id: targetId }, select: { type: true } });
      return profile?.type === 'ARTIST';
    }
    case 'VENUE': {
      const profile = await db.profile.findUnique({ where: { id: targetId }, select: { type: true } });
      return profile?.type === 'VENUE';
    }
    case 'ALBUM': {
      const media = await db.artistMediaAsset.findUnique({ where: { id: targetId }, select: { id: true } });
      return Boolean(media);
    }
    case 'ADVERTISEMENT': {
      const ad = await db.ad.findUnique({ where: { id: targetId }, select: { id: true } });
      return Boolean(ad);
    }
  }
}

/**
 * GET /api/likes                      → every like on the account (newest first)
 * GET /api/likes?targetType=&targetId= → { liked } for one target
 *
 * The single-target form is what lights a heart on arrival — a control that
 * cannot read its own stored state re-offers a like the account already
 * holds, which is the bug this feature exists to end.
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Login required' }, { status: 401 });

  const url = new URL(request.url);
  const targetType = url.searchParams.get('targetType');
  const targetId = url.searchParams.get('targetId');

  try {
    if (targetType || targetId) {
      const parsed = likeSchema.safeParse({ targetType, targetId });
      if (!parsed.success) return NextResponse.json({ error: 'Unknown like target' }, { status: 400 });
      const row = await db.like.findUnique({
        where: {
          userId_targetType_targetId: {
            userId: session.user.id,
            targetType: parsed.data.targetType,
            targetId: parsed.data.targetId,
          },
        },
        select: { id: true },
      });
      return NextResponse.json({ liked: Boolean(row) });
    }

    const likes = await db.like.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      select: { targetType: true, targetId: true, createdAt: true },
    });
    return NextResponse.json({ likes });
  } catch (error) {
    log.error('likes: read failed', { error });
    return NextResponse.json({ error: 'Could not read likes' }, { status: 500 });
  }
}

/** POST { targetType, targetId } → like (idempotent). */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Login required' }, { status: 401 });

  const rl = await consumeRateLimit(`likes:${session.user.id}`, { limit: 120, windowMs: 60 * 1000 });
  if (!rl.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  try {
    const body = likeSchema.parse(await request.json());
    if (!(await targetExists(body.targetType, body.targetId))) {
      return NextResponse.json({ error: 'No such target' }, { status: 404 });
    }
    await db.like.upsert({
      where: {
        userId_targetType_targetId: {
          userId: session.user.id,
          targetType: body.targetType,
          targetId: body.targetId,
        },
      },
      create: { userId: session.user.id, targetType: body.targetType, targetId: body.targetId },
      // "Only once": a second like changes nothing, not even createdAt —
      // the first like's date is when the account started liking this.
      update: {},
    });
    return NextResponse.json({ liked: true });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Unknown like target' }, { status: 400 });
    log.error('likes: create failed', { error });
    return NextResponse.json({ error: 'Could not save the like' }, { status: 500 });
  }
}

/** DELETE { targetType, targetId } → unlike (idempotent). */
export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Login required' }, { status: 401 });

  try {
    const body = likeSchema.parse(await request.json());
    await db.like.deleteMany({
      where: { userId: session.user.id, targetType: body.targetType, targetId: body.targetId },
    });
    return NextResponse.json({ liked: false });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Unknown like target' }, { status: 400 });
    log.error('likes: delete failed', { error });
    return NextResponse.json({ error: 'Could not remove the like' }, { status: 500 });
  }
}

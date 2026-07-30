import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { log } from '@/lib/logger';
import { awardHype } from '@/lib/hype-ledger';
import { consumeRateLimit, rateLimitHeaders, rateLimitKey } from '@/lib/rate-limit';

const schema = z.object({
  showId: z.string().min(1).max(128),
  title: z.string().min(1).max(200),
  showSlug: z.string().min(1).max(160),
  playbackUrl: z.string().url().max(2048)
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Login required' }, { status: 401 });
  }

  try {
    const rateLimit = await consumeRateLimit(
      rateLimitKey('show-listen', session.user.id, request.headers.get('x-forwarded-for')),
      { limit: 12, windowMs: 60 * 60 * 1000 },
    );
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many show completions.' },
        { status: 429, headers: rateLimitHeaders(rateLimit) },
      );
    }
    const payload = schema.parse(await request.json());
    const show = await db.show.findFirst({
      where: {
        id: payload.showId,
        isRadioShow: true,
        moderationStatus: 'APPROVED',
        status: { in: ['SCHEDULED', 'LIVE', 'ENDED'] },
      },
      select: { id: true, title: true, slug: true },
    });
    if (!show) {
      return NextResponse.json({ error: 'Published radio show not found' }, { status: 404 });
    }

    await db.showListen.upsert({
      where: {
        userId_showId: {
          userId: session.user.id,
          showId: payload.showId
        }
      },
      update: {
        title: show.title,
        showSlug: show.slug,
        playbackUrl: `/shows/${show.slug}`,
        completedAt: new Date()
      },
      create: {
        userId: session.user.id,
        showId: show.id,
        title: show.title,
        showSlug: show.slug,
        playbackUrl: `/shows/${show.slug}`,
        completedAt: new Date()
      }
    });

    const reward = await awardHype({
      userId: session.user.id,
      amount: 3,
      source: 'RADIO_SHOW_COMPLETED',
      idempotencyKey: `radio-show-completed:${session.user.id}:${show.id}`,
      targetType: 'radio_show',
      targetId: show.id,
      dailyLimit: 15,
    });

    return NextResponse.json({
      recorded: true,
      hypeAwarded: reward.applied ? reward.entry?.amount ?? 0 : 0,
      hypeBalance: reward.entry?.balanceAfter,
    });
  } catch (err) {
    log.error('[show-listens]', err instanceof Error ? err : { error: String(err) });
    return NextResponse.json({ error: 'Invalid show listen payload' }, { status: 400 });
  }
}

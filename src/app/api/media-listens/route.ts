import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { log } from '@/lib/logger';
import { awardHype } from '@/lib/hype-ledger';
import { consumeRateLimit, rateLimitHeaders, rateLimitKey } from '@/lib/rate-limit';

const schema = z.object({
  mediaId: z.string().min(1).max(128),
  title: z.string().min(1).max(200),
  mediaUrl: z.string().url().max(2048),
  artistName: z.string().min(1).max(160),
  artistProfileSlug: z.string().min(1).max(160).optional()
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Login required' }, { status: 401 });
  }

  try {
    const rateLimit = await consumeRateLimit(
      rateLimitKey('media-listen', session.user.id, request.headers.get('x-forwarded-for')),
      { limit: 40, windowMs: 60 * 60 * 1000 },
    );
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many listen completions.' },
        { status: 429, headers: rateLimitHeaders(rateLimit) },
      );
    }
    const payload = schema.parse(await request.json());
    const media = await db.artistMediaAsset.findFirst({
      where: { id: payload.mediaId, isPublished: true },
      select: {
        id: true,
        title: true,
        storageUrl: true,
        profile: { select: { name: true, slug: true, discoverable: true } },
      },
    });
    if (!media?.profile.discoverable) {
      return NextResponse.json({ error: 'Published media not found' }, { status: 404 });
    }

    await db.mediaListen.upsert({
      where: {
        userId_mediaId: {
          userId: session.user.id,
          mediaId: payload.mediaId
        }
      },
      update: {
        title: media.title,
        mediaUrl: media.storageUrl ?? payload.mediaUrl,
        artistName: media.profile.name,
        artistProfileSlug: media.profile.slug,
        completedAt: new Date()
      },
      create: {
        userId: session.user.id,
        mediaId: media.id,
        title: media.title,
        mediaUrl: media.storageUrl ?? payload.mediaUrl,
        artistName: media.profile.name,
        artistProfileSlug: media.profile.slug,
        completedAt: new Date()
      }
    });

    const reward = await awardHype({
      userId: session.user.id,
      amount: 1,
      source: 'TRACK_COMPLETED',
      idempotencyKey: `track-completed:${session.user.id}:${media.id}`,
      targetType: 'track',
      targetId: media.id,
      dailyLimit: 20,
    });

    return NextResponse.json({
      recorded: true,
      hypeAwarded: reward.applied ? reward.entry?.amount ?? 0 : 0,
      hypeBalance: reward.entry?.balanceAfter,
    });
  } catch (err) {
    log.error('[media-listens]', err instanceof Error ? err : { error: String(err) });
    return NextResponse.json({ error: 'Invalid media listen payload' }, { status: 400 });
  }
}

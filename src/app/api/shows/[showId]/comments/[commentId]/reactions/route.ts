import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { consumeRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const ALLOWED_EMOJIS = new Set(['👍', '❤️', '🔥']);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ showId: string; commentId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Sign in to react.' }, { status: 401 });
  }

  const rate = await consumeRateLimit(`reactions:${session.user.id}`, {
    limit: 60,
    windowMs: 60 * 1000
  });
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
  }

  const { commentId } = await params;

  let body: { emoji?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    // ignore
  }

  const emoji = typeof body.emoji === 'string' ? body.emoji : '';
  if (!ALLOWED_EMOJIS.has(emoji)) {
    return NextResponse.json({ error: 'Invalid emoji.' }, { status: 400 });
  }

  const comment = await db.showComment.findUnique({
    where: { id: commentId },
    select: { id: true }
  });
  if (!comment) return NextResponse.json({ error: 'Comment not found.' }, { status: 404 });

  const existing = await db.commentReaction.findUnique({
    where: {
      commentId_userId_emoji: {
        commentId,
        userId: session.user.id,
        emoji
      }
    }
  });

  if (existing) {
    await db.commentReaction.delete({ where: { id: existing.id } });
  } else {
    await db.commentReaction.create({
      data: { commentId, userId: session.user.id, emoji }
    });
  }

  const reactions = await db.commentReaction.groupBy({
    by: ['emoji'],
    where: { commentId },
    _count: { emoji: true }
  });

  return NextResponse.json({
    reactions: reactions.map((r) => ({ emoji: r.emoji, count: r._count.emoji }))
  });
}

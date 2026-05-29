import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { consumeRateLimit } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';
import { checkContent } from '@/lib/auto-mod';

export const dynamic = 'force-dynamic';
const MAX_CONTENT = 1500;

export async function POST(request: NextRequest, { params }: { params: Promise<{ showId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Sign in to comment.' }, { status: 401 });
  }
  const clientAddress = readClientAddress(request);
  const rate = await consumeRateLimit(`show-comment:${session.user.id}`, {
    limit: 20,
    windowMs: 60 * 60 * 1000
  });
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Too many comments. Try later.' }, { status: 429 });
  }

  const { showId } = await params;
  let body: { content?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    // ignore
  }
  const content = typeof body.content === 'string' ? body.content.trim().slice(0, MAX_CONTENT) : '';
  if (!content) {
    return NextResponse.json({ error: 'Comment is empty.' }, { status: 400 });
  }

  const show = await db.show.findUnique({ where: { id: showId }, select: { id: true } });
  if (!show) return NextResponse.json({ error: 'Show not found.' }, { status: 404 });

  const modCheck = checkContent(content);
  if (modCheck.flagged) {
    await db.supportRequest.create({
      data: {
        requesterUserId: session.user.id,
        type: 'AUTO_MOD_FLAG',
        subject: `Auto-mod flag on comment`,
        details: `Comment content flagged (${modCheck.reason ?? 'unknown'}): ${content.slice(0, 500)}`,
        priority: 'NORMAL',
      },
    });
  }

  const comment = await db.showComment.create({
    data: { showId: show.id, userId: session.user.id, content },
    select: {
      id: true,
      createdAt: true,
      content: true,
      user: { select: { name: true, username: true } }
    }
  });

  return NextResponse.json({
    ok: true,
    comment: {
      id: comment.id,
      createdAt: comment.createdAt.toISOString(),
      content: comment.content,
      author: comment.user.name ?? comment.user.username ?? 'iHYPE fan'
    }
  });
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ showId: string }> }) {
  const { showId } = await params;
  const rows = await db.showComment.findMany({
    where: { showId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      createdAt: true,
      content: true,
      user: { select: { name: true, username: true } },
      reactions: {
        select: { emoji: true }
      }
    }
  });

  const comments = rows.map((r) => {
    const reactionCounts: Record<string, number> = {};
    for (const rx of r.reactions) {
      reactionCounts[rx.emoji] = (reactionCounts[rx.emoji] ?? 0) + 1;
    }
    return {
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      content: r.content,
      author: r.user.name ?? r.user.username ?? 'iHYPE fan',
      reactions: Object.entries(reactionCounts).map(([emoji, count]) => ({ emoji, count }))
    };
  });

  return NextResponse.json({ comments });
}

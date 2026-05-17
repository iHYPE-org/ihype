import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { recordAuditEvent } from '@/lib/audit';
import { consumeRateLimit } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';

export const dynamic = 'force-dynamic';
const MAX_CONTENT = 1500;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const { id: showId } = await params;
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

  await recordAuditEvent({
    actorUserId: session.user.id,
    action: 'show_comment',
    entityType: 'show',
    entityId: show.id,
    ipAddress: clientAddress,
    metadata: { showId: show.id, content, userId: session.user.id }
  });

  return NextResponse.json({ ok: true });
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: showId } = await params;
  const rows = await db.auditLog.findMany({
    where: { action: 'show_comment', entityType: 'show', entityId: showId },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      id: true,
      createdAt: true,
      metadata: true,
      actor: { select: { name: true, username: true } }
    }
  });
  const comments = rows.map((r) => {
    const meta = (r.metadata ?? {}) as { content?: string };
    return {
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      content: typeof meta.content === 'string' ? meta.content : '',
      author: r.actor?.name ?? r.actor?.username ?? 'iHYPE fan'
    };
  });
  return NextResponse.json({ comments });
}

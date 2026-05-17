import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { recordAuditEvent } from '@/lib/audit';
import { consumeRateLimit } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';
import { isAdminSession } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });

  const { id: showId } = await params;
  const show = await db.show.findUnique({ where: { id: showId }, select: { id: true, creatorId: true } });
  if (!show) return NextResponse.json({ error: 'Show not found.' }, { status: 404 });
  if (show.creatorId !== session.user.id && !isAdminSession(session)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const rate = await consumeRateLimit(`show-setlist:${session.user.id}`, { limit: 30, windowMs: 60 * 60 * 1000 });
  if (!rate.allowed) return NextResponse.json({ error: 'Too many updates.' }, { status: 429 });

  let body: { tracks?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    // ignore
  }
  const tracks = Array.isArray(body.tracks)
    ? body.tracks
        .map((t) => (typeof t === 'string' ? t.trim().slice(0, 200) : ''))
        .filter((t) => t.length > 0)
        .slice(0, 100)
    : [];

  await recordAuditEvent({
    actorUserId: session.user.id,
    action: 'show_setlist',
    entityType: 'show',
    entityId: show.id,
    ipAddress: readClientAddress(request),
    metadata: { showId: show.id, tracks }
  });

  return NextResponse.json({ ok: true, tracks });
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: showId } = await params;
  const last = await db.auditLog.findFirst({
    where: { action: 'show_setlist', entityType: 'show', entityId: showId },
    orderBy: { createdAt: 'desc' },
    select: { metadata: true, createdAt: true }
  });
  const meta = (last?.metadata ?? {}) as { tracks?: unknown };
  const tracks = Array.isArray(meta.tracks)
    ? (meta.tracks.filter((t) => typeof t === 'string') as string[])
    : [];
  return NextResponse.json({ tracks, updatedAt: last?.createdAt?.toISOString() ?? null });
}

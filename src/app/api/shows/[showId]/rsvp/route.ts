import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { consumeRateLimit } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ showId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Sign in to RSVP.' }, { status: 401 });
    }
    const clientAddress = readClientAddress(request);
    const rate = await consumeRateLimit(`show-rsvp:${session.user.id}`, {
      limit: 30,
      windowMs: 60 * 60 * 1000
    });
    if (!rate.allowed) {
      return NextResponse.json({ error: 'Too many RSVP toggles.' }, { status: 429 });
    }

    const { showId } = await params;
    const show = await db.show.findUnique({ where: { id: showId }, select: { id: true } });
    if (!show) return NextResponse.json({ error: 'Show not found.' }, { status: 404 });

    const existing = await db.showRsvp.findUnique({
      where: { showId_userId: { showId: show.id, userId: session.user.id } }
    });

    if (existing) {
      await db.showRsvp.delete({ where: { id: existing.id } });
    } else {
      await db.showRsvp.create({ data: { showId: show.id, userId: session.user.id } });
    }

    const count = await db.showRsvp.count({ where: { showId: show.id } });
    return NextResponse.json({ going: !existing, count });
  } catch (err) {
    console.error('[api/shows/[showId]/rsvp] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ showId: string }> }) {
  try {
    const session = await auth();
    const { showId } = await params;

    const [count, rsvp] = await Promise.all([
      db.showRsvp.count({ where: { showId } }),
      session?.user?.id
        ? db.showRsvp.findUnique({
            where: { showId_userId: { showId, userId: session.user.id } }
          })
        : Promise.resolve(null)
    ]);

    return NextResponse.json({ going: Boolean(rsvp), count });
  } catch (err) {
    console.error('[api/shows/[showId]/rsvp] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

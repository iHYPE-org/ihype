import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

// GET — public, returns opted-in attendees (name + avatar only)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ showId: string }> }
) {
  const { showId: id } = await params;

  const attendees = await db.showAttendee.findMany({
    where: { showId: id, optedIn: true },
    include: {
      user: { select: { name: true, image: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json({
    attendees: attendees.map((a) => ({
      name: a.user.name,
      avatar: a.user.image,
    })),
    count: attendees.length,
  });
}

// POST — auth: toggle opt-in
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ showId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Login required' }, { status: 401 });
  }

  const { showId } = await params;

  const show = await db.show.findUnique({ where: { id: showId }, select: { status: true } });
  if (show?.status !== 'ENDED') {
    return NextResponse.json({ error: 'Show has not ended' }, { status: 400 });
  }
  const hasTicket = await db.ticketOrder.findFirst({
    where: { showId, buyerUserId: session.user.id, status: 'CAPTURED' },
  });
  if (!hasTicket) {
    return NextResponse.json({ error: 'No confirmed ticket' }, { status: 403 });
  }

  const existing = await db.showAttendee.findUnique({
    where: { userId_showId: { userId: session.user.id, showId } },
  });

  if (existing) {
    const updated = await db.showAttendee.update({
      where: { userId_showId: { userId: session.user.id, showId } },
      data: { optedIn: !existing.optedIn },
    });
    return NextResponse.json({ optedIn: updated.optedIn });
  }

  await db.showAttendee.create({
    data: { userId: session.user.id, showId, optedIn: true },
  });

  return NextResponse.json({ optedIn: true });
}

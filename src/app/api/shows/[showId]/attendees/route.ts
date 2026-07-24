import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

// GET — public, returns opted-in attendees (name + avatar only)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ showId: string }> }
) {
  const { showId: id } = await params;

  // This endpoint is public and unauthenticated, and a popular show can have
  // thousands of opted-in attendees. The UI only renders an avatar preview
  // (ShowEngagement.tsx slices to the first 8) and shows the total separately,
  // so cap the joined rows we return and get the true total from a cheap
  // count() — otherwise every anonymous request streams the entire attendee
  // list with a user join.
  const ATTENDEE_PREVIEW_LIMIT = 24;
  const [attendees, count] = await Promise.all([
    db.showAttendee.findMany({
      where: { showId: id, optedIn: true },
      include: {
        user: { select: { name: true, image: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: ATTENDEE_PREVIEW_LIMIT,
    }),
    db.showAttendee.count({ where: { showId: id, optedIn: true } }),
  ]);

  return NextResponse.json({
    attendees: attendees.map((a) => ({
      name: a.user.name,
      avatar: a.user.image,
    })),
    count,
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

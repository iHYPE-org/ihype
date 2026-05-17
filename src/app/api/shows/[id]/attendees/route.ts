import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

// GET — public, returns opted-in attendees (name + avatar only)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

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
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Login required' }, { status: 401 });
  }

  const { id: showId } = await params;

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

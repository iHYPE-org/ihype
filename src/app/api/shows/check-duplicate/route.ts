import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { headlinerProfileId, venueProfileId, date } = await request.json() as { headlinerProfileId?: string; venueProfileId?: string; date?: string };
  if (!date) return NextResponse.json({ duplicate: false });

  const dateObj = new Date(date);
  const dayStart = new Date(dateObj); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dateObj); dayEnd.setHours(23, 59, 59, 999);

  const existing = await db.show.findFirst({
    where: {
      startsAt: { gte: dayStart, lte: dayEnd },
      ...(headlinerProfileId ? { headlinerProfileId } : {}),
      ...(venueProfileId ? { venueProfileId } : {}),
      status: { not: 'CANCELED' }
    },
    select: { id: true, title: true, slug: true, startsAt: true }
  });

  return NextResponse.json({ duplicate: !!existing, existing });
}

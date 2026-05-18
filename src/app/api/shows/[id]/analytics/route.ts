import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const show = await db.show.findUnique({
    where: { id },
    select: { id: true, title: true, creatorId: true, ticketsSoldCount: true, ticketCapacity: true,
      tickets: { select: { status: true, scannedAt: true } },
      hypes: { select: { id: true } },
      rsvps: { select: { id: true } },
      attendees: { select: { id: true } },
    }
  });
  if (!show) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (show.creatorId !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const scanned = show.tickets.filter(t => t.status === 'SCANNED').length;
  const sold = show.tickets.length;
  return NextResponse.json({
    name: show.title,
    ticketsSold: sold,
    ticketsScanned: scanned,
    attendanceRate: sold > 0 ? Math.round((scanned / sold) * 100) : 0,
    capacity: show.ticketCapacity,
    hypes: show.hypes.length,
    rsvps: show.rsvps.length,
  });
}

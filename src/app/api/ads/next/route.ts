import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const slotId = searchParams.get('slotId');

  const now = new Date();

  const ad = await db.ad.findFirst({
    where: {
      status: 'APPROVED',
      slot: slotId ? { id: slotId, active: true } : { active: true },
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
    },
    orderBy: [{ impressions: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true, title: true, audioUrl: true, imageUrl: true, clickUrl: true,
      slot: { select: { id: true, name: true } },
    },
  });

  if (!ad) return NextResponse.json({ ad: null });
  return NextResponse.json({ ad });
}

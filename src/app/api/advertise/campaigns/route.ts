import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  const campaigns = await db.ad.findMany({
    where: { advertiserId: session.user.id },
    include: { slot: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ campaigns });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  let body: {
    slotId?: unknown; title?: unknown; audioUrl?: unknown; imageUrl?: unknown;
    clickUrl?: unknown; budgetCents?: unknown; startsAt?: unknown; endsAt?: unknown;
  };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }); }

  const slotId = typeof body.slotId === 'string' ? body.slotId : '';
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!slotId || !title) return NextResponse.json({ error: 'slotId and title are required.' }, { status: 400 });

  // Verify slot exists and is active
  const slot = await db.adSlot.findUnique({ where: { id: slotId, active: true } });
  if (!slot) return NextResponse.json({ error: 'Ad slot not found.' }, { status: 404 });

  const ad = await db.ad.create({
    data: {
      slotId,
      advertiserId: session.user.id,
      title,
      audioUrl: typeof body.audioUrl === 'string' ? body.audioUrl : undefined,
      imageUrl: typeof body.imageUrl === 'string' ? body.imageUrl : undefined,
      clickUrl: typeof body.clickUrl === 'string' ? body.clickUrl : undefined,
      budgetCents: typeof body.budgetCents === 'number' ? body.budgetCents : 0,
      startsAt: typeof body.startsAt === 'string' ? new Date(body.startsAt) : undefined,
      endsAt: typeof body.endsAt === 'string' ? new Date(body.endsAt) : undefined,
      status: 'PENDING',
    },
    include: { slot: { select: { name: true } } },
  });

  return NextResponse.json({ ad }, { status: 201 });
}

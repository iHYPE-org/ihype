import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Login required' }, { status: 401 });
  }

  const [user, entries] = await Promise.all([
    db.user.findUnique({
      where: { id: session.user.id },
      select: { hypeBalance: true },
    }),
    db.hypeLedgerEntry.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        amount: true,
        balanceAfter: true,
        source: true,
        targetType: true,
        targetId: true,
        metadata: true,
        createdAt: true,
      },
    }),
  ]);

  return NextResponse.json({
    balance: user?.hypeBalance ?? 0,
    entries,
    earningRules: {
      completedTrack: 1,
      completedRadioShow: 3,
      attendedEvent: 5,
      referredFan: 10,
    },
  });
}

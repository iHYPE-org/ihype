import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Login required' }, { status: 401 });
  }

  let body: { showId?: string; reason?: string; expectedAmountCents?: number } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { showId, reason, expectedAmountCents } = body;
  if (!showId || !reason || expectedAmountCents === undefined) {
    return NextResponse.json({ error: 'showId, reason, and expectedAmountCents are required' }, { status: 400 });
  }

  const supportRequest = await db.supportRequest.create({
    data: {
      requesterUserId: session.user.id,
      type: 'PAYOUT_DISPUTE',
      subject: `Payout dispute for show ${showId}`,
      details: `Expected: $${(expectedAmountCents / 100).toFixed(2)}. Reason: ${reason}`,
      priority: 'HIGH',
      status: 'OPEN',
    },
  });

  return NextResponse.json({ submitted: true, ticketId: supportRequest.id });
}

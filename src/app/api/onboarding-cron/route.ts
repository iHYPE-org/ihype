import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendDay3Email, sendDay7Email } from '@/lib/onboarding-emails';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function isAuthorized(request: NextRequest): boolean {
  if (request.headers.get('x-vercel-cron')) return true;
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    return true;
  }
  return false;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const now = new Date();

  const day3Start = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000);
  const day3End = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const day7Start = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
  const day7End = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [day3Users, day7Users] = await Promise.all([
    db.user.findMany({
      where: { createdAt: { gte: day3Start, lt: day3End } },
      select: { id: true, profileHypeEvents: { take: 1, select: { id: true } } }
    }),
    db.user.findMany({
      where: { createdAt: { gte: day7Start, lt: day7End } },
      select: { id: true, profileHypeEvents: { take: 1, select: { id: true } } }
    })
  ]);

  let sent3 = 0;
  for (const user of day3Users) {
    if (user.profileHypeEvents.length === 0) {
      try {
        await sendDay3Email(user.id);
        sent3++;
      } catch {
        // continue
      }
    }
  }

  let sent7 = 0;
  for (const user of day7Users) {
    if (user.profileHypeEvents.length === 0) {
      try {
        await sendDay7Email(user.id);
        sent7++;
      } catch {
        // continue
      }
    }
  }

  return NextResponse.json({ ok: true, sent3, sent7 });
}

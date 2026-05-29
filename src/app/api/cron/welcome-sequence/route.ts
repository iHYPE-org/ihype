import { NextRequest, NextResponse } from 'next/server';
import { isCronRequestAuthorized } from '@/lib/cron-auth';
import { db } from '@/lib/db';
import { sendDay3NudgeEmail, sendDay7NudgeEmail } from '@/lib/welcome-emails';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const day3Start = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000);
  const day3End = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const day7Start = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
  const day7End = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [day3Users, day7Users] = await Promise.all([
    db.user.findMany({
      where: { createdAt: { gte: day3Start, lt: day3End }, welcomeDay3SentAt: null },
      select: { id: true, email: true, name: true },
    }),
    db.user.findMany({
      where: { createdAt: { gte: day7Start, lt: day7End }, welcomeDay7SentAt: null },
      select: { id: true, email: true, name: true },
    }),
  ]);

  let day3Sent = 0, day7Sent = 0;

  for (const user of day3Users) {
    if (!user.email) continue;
    try {
      await sendDay3NudgeEmail({ id: user.id, email: user.email, name: user.name });
      await db.user.update({ where: { id: user.id }, data: { welcomeDay3SentAt: now } });
      day3Sent++;
    } catch { /* continue */ }
  }

  for (const user of day7Users) {
    if (!user.email) continue;
    try {
      await sendDay7NudgeEmail({ id: user.id, email: user.email, name: user.name });
      await db.user.update({ where: { id: user.id }, data: { welcomeDay7SentAt: now } });
      day7Sent++;
    } catch { /* continue */ }
  }

  return NextResponse.json({ ok: true, day3Sent, day7Sent });
}

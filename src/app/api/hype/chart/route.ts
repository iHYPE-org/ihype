import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const profileId = new URL(request.url).searchParams.get('profileId');
  if (!profileId) return NextResponse.json({ error: 'profileId required' }, { status: 400 });

  const since = new Date();
  since.setDate(since.getDate() - 30);

  const events = await db.profileHypeEvent.findMany({
    where: { profileId, createdAt: { gte: since } },
    select: { createdAt: true },
  }).catch(() => []);

  const counts: Record<string, number> = {};
  for (const e of events) {
    const day = e.createdAt.toISOString().slice(0, 10);
    counts[day] = (counts[day] ?? 0) + 1;
  }

  const days: { date: string; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const day = d.toISOString().slice(0, 10);
    days.push({ date: day, count: counts[day] ?? 0 });
  }

  return NextResponse.json({ days });
}

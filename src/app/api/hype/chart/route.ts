import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { readList } from '@/lib/read-list';
import { readUnavailableResponse } from '@/lib/read-unavailable';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const profileId = new URL(request.url).searchParams.get('profileId');
  if (!profileId) return NextResponse.json({ error: 'profileId required' }, { status: 400 });

  const since = new Date();
  since.setDate(since.getDate() - 30);

  // Bucketed by day in Postgres instead of pulling every hype event row
  // just to group by date in JS.
  // Caught to `[]` this drew thirty days of zeros over a query that did not
  // run — a sparkline is a claim too (DESIGN_SYNC row 451).
  const rows = await readList(db.$queryRaw<{ day: string; count: bigint }[]>`
    SELECT to_char("createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day, COUNT(*)::bigint AS count
    FROM "ProfileHypeEvent"
    WHERE "profileId" = ${profileId} AND "createdAt" >= ${since}
    GROUP BY day
  `);
  if (rows === null) return readUnavailableResponse('The hype chart');

  const counts: Record<string, number> = {};
  for (const row of rows) {
    counts[row.day] = Number(row.count);
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

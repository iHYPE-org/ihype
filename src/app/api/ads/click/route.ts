import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let body: { adId?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }); }

  const adId = typeof body.adId === 'string' ? body.adId : '';
  if (!adId) return NextResponse.json({ error: 'adId is required.' }, { status: 400 });

  const ad = await db.ad.update({
    where: { id: adId },
    data: { clicks: { increment: 1 } },
    select: { clickUrl: true },
  });

  return NextResponse.json({ ok: true, clickUrl: ad.clickUrl });
}

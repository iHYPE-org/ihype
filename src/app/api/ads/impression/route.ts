import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const session = await auth();
  let body: { adId?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }); }

  const adId = typeof body.adId === 'string' ? body.adId : '';
  if (!adId) return NextResponse.json({ error: 'adId is required.' }, { status: 400 });

  await Promise.all([
    db.adImpression.create({ data: { adId, userId: session?.user?.id ?? undefined } }),
    db.ad.update({ where: { id: adId }, data: { impressions: { increment: 1 } } }),
  ]);

  return NextResponse.json({ ok: true });
}

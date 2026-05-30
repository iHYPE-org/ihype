import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { consumeRateLimit } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const session = await auth();
  const ip = readClientAddress(request);
  const userId = session?.user?.id ?? `anon:${ip}`;

  const rl = await consumeRateLimit(`ad-click:${userId}`, { limit: 20, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 });
  }

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

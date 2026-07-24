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

  const rl = await consumeRateLimit(`ad-impression:${userId}`, { limit: 100, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 });
  }

  let body: { adId?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }); }

  const adId = typeof body.adId === 'string' ? body.adId : '';
  if (!adId) return NextResponse.json({ error: 'adId is required.' }, { status: 400 });

  // Per-user 24h dedup
  if (session?.user?.id) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const existing = await db.adImpression.findFirst({
      where: { adId, userId: session.user.id, createdAt: { gte: since } },
      select: { id: true },
    });
    if (existing) return NextResponse.json({ ok: true, skipped: true });
  }

  // Only a genuinely servable ad may spend budget. Mirror the serve-side
  // gate in ad-clip-selection.ts exactly (status APPROVED, inside the run
  // window, budget not exhausted) so a paused/cancelled/expired campaign —
  // or a stale/forged client still firing impressions — can never be
  // charged. An unknown adId is skipped rather than falling through to
  // db.ad.update, which would throw P2025 (record not found) and 500.
  const ad = await db.ad.findUnique({
    where: { id: adId },
    select: { status: true, startsAt: true, endsAt: true, budgetCents: true, spentCents: true },
  });
  if (!ad) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'unknown_ad' });
  }
  const now = new Date();
  const notActive = ad.status !== 'APPROVED';
  const beforeWindow = ad.startsAt !== null && ad.startsAt > now;
  const afterWindow = ad.endsAt !== null && ad.endsAt < now;
  if (notActive || beforeWindow || afterWindow) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'not_active' });
  }
  if (ad.budgetCents > 0 && ad.spentCents >= ad.budgetCents) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'budget_exhausted' });
  }

  await Promise.all([
    db.adImpression.create({ data: { adId, userId: session?.user?.id ?? undefined } }),
    db.ad.update({ where: { id: adId }, data: { impressions: { increment: 1 }, spentCents: { increment: 9 } } }),
  ]);

  return NextResponse.json({ ok: true });
}

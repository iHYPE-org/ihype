import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { consumeRateLimit } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const session = await auth();
  /* Signed-in listeners only (security sweep, 2026-09-02). An impression
     SPENDS an advertiser's authorized budget — `spentCents` is what the
     settlement cron captures — and `adId` is public in every station and
     sequence payload. Anonymous callers were rate-limited per IP but never
     deduplicated, so 100 POSTs an hour from each address drained a real
     campaign for plays nobody heard. A member is deduplicated to one charge
     per ad per day below, which caps what any one account can cost an
     advertiser at cents. Every player that fires this runs inside the
     signed-in shell, so nothing legitimate is refused. */
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  }
  const userId = session.user.id;
  const ip = readClientAddress(request);

  const rl = await consumeRateLimit(`ad-impression:${userId}:${ip}`, { limit: 100, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 });
  }

  let body: { adId?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }); }

  const adId = typeof body.adId === 'string' ? body.adId : '';
  if (!adId) return NextResponse.json({ error: 'adId is required.' }, { status: 400 });

  // Per-user 24h dedup — one charge per listener per ad per day.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const existing = await db.adImpression.findFirst({
    where: { adId, userId, createdAt: { gte: since } },
    select: { id: true },
  });
  if (existing) return NextResponse.json({ ok: true, skipped: true });

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

  // Spend the budget with the guard in the WHERE clause, not in JS above it.
  // The read-then-update shape could let concurrent impressions all pass the
  // budget check before any increment landed, overspending an advertiser's
  // authorized hold — the settlement cron has to cap spentCents at
  // budgetCents precisely because this could drift past it. updateMany with
  // the same conditions makes the check and the increment one statement, so
  // the last impression that fits is the last one charged. The pre-read above
  // stays: it answers "why was this skipped" for the response body, which a
  // conditional update alone cannot.
  const charged = await db.ad.updateMany({
    where: {
      id: adId,
      status: 'APPROVED',
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
      ...(ad.budgetCents > 0 ? { spentCents: { lt: ad.budgetCents } } : {}),
    },
    data: { impressions: { increment: 1 }, spentCents: { increment: 9 } },
  });

  if (charged.count === 0) {
    // Lost the race — the campaign was exhausted, paused, or expired between
    // the read and the write. Not an error: the ad still played, it just
    // doesn't get charged twice.
    return NextResponse.json({ ok: true, skipped: true, reason: 'not_active' });
  }

  await db.adImpression.create({ data: { adId, userId } });

  return NextResponse.json({ ok: true });
}

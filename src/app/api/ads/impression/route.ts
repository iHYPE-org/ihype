import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { consumeRateLimit } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';
import { verifyAdPlayToken } from '@/lib/ad-play-token';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const session = await auth();
  /* One charge per listener per ad per day (security sweep, 2026-09-02). An
     impression SPENDS an advertiser's authorized budget — `spentCents` is
     what the settlement cron captures — and `adId` is public in every station
     and sequence payload. Anonymous callers used to be rate-limited per IP
     and never deduplicated, so 100 POSTs an hour from each address drained a
     real campaign for plays nobody heard. Now a member is deduplicated on the
     impression rows and an anonymous listener on a 24-hour address+ad bucket
     (the public show page plays ads to signed-out visitors, so refusing them
     outright was free airtime), which caps what any one caller can cost an
     advertiser at nine cents per ad per day.

     That cap was the whole defence until 2026-09-09 and it capped the wrong
     thing: it bounded how much any one caller could cost a campaign, and never
     asked whether the ad had been served to them at all. The play token below
     is what asks. The dedup stays — it is what makes a legitimately held token
     unprofitable to replay, which is why the token does not need to be
     single-use. */
  const userId = session?.user?.id ?? null;
  const ip = readClientAddress(request);

  const rl = await consumeRateLimit(`ad-impression:${userId ?? `anon:${ip}`}`, { limit: 100, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 });
  }

  let body: { adId?: unknown; playToken?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }); }

  /* THE CAMPAIGN COMES OUT OF THE TOKEN, NEVER OFF THE BODY. `adId` is public
     in every station payload and every show production plan, so a route that
     believed the body would spend a stranger's budget for anyone who could
     read one — the rate limit and the daily dedup only capped how MUCH, never
     whether the ad had been served at all. `playToken` is the server's own
     receipt for serving this spot to this listener; see
     `src/lib/ad-play-token.ts`, including why it fails towards not charging.

     `adId` is still read, purely as a cross-check: a client sending both and
     disagreeing is a bug worth surfacing rather than silently resolving in
     favour of one of them. */
  const verified = verifyAdPlayToken(typeof body.playToken === 'string' ? body.playToken : null, userId);
  if (!verified.ok) {
    if (verified.reason === 'unconfigured') {
      /* No signing secret means no impression can be proven, so none is
         charged. Loud, because it silently zeroes ad delivery. */
      log.error('[api/ads/impression]', { error: 'AUTH_SECRET unreadable; ad impressions cannot be verified' }, 'play token unconfigured');
      return NextResponse.json({ error: 'Impression reporting is unavailable.' }, { status: 503 });
    }
    if (verified.reason === 'expired') {
      // An honest late report from a queue served hours ago. Not an error, and
      // not a charge either.
      return NextResponse.json({ ok: true, skipped: true, reason: 'expired' });
    }
    return NextResponse.json({ error: 'A valid play token is required.', reason: verified.reason }, { status: 400 });
  }

  const adId = verified.adId;
  if (typeof body.adId === 'string' && body.adId !== adId) {
    return NextResponse.json({ error: 'The play token names a different campaign.', reason: 'ad_mismatch' }, { status: 400 });
  }

  // One charge per listener per ad per day. A member is deduplicated on the
  // impression rows; an anonymous listener (the public show page plays ads to
  // signed-out visitors) on a 24-hour bucket keyed by address and ad, which
  // is the same cap without an account — the second scan found the outright
  // refusal dropped every signed-out play, free airtime for the advertiser.
  if (userId) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const existing = await db.adImpression.findFirst({
      where: { adId, userId, createdAt: { gte: since } },
      select: { id: true },
    });
    if (existing) return NextResponse.json({ ok: true, skipped: true });
  } else {
    const once = await consumeRateLimit(`ad-impression:play:${ip}:${adId}`, { limit: 1, windowMs: 24 * 60 * 60 * 1000 });
    if (!once.allowed) return NextResponse.json({ ok: true, skipped: true });
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

  await db.adImpression.create({ data: { adId, userId: userId ?? undefined } });

  return NextResponse.json({ ok: true });
}

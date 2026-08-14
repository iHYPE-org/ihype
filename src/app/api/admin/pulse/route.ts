import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isAdminSession } from '@/lib/permissions';
import { consumeRateLimit } from '@/lib/rate-limit';
import { log } from '@/lib/logger';
import { getAdminPulse } from '@/lib/admin-pulse-data';
import { isAnalyticsRange, type AnalyticsRange } from '@/lib/analytics-engine';

export const dynamic = 'force-dynamic';

/**
 * `GET /api/admin/pulse?range=`
 *
 * The console's live read. `AdminPulse` polls this; nothing else should.
 *
 * ## Why a route and not `router.refresh()`
 *
 * Refreshing `/admin` re-runs the whole 1063-line server component — 67
 * queries plus every interactive panel — to update six numbers. On a phone,
 * on a poll, that is the difference between a console you can leave open and
 * one you cannot afford to. This returns only the snapshot.
 *
 * ## Admin-only, and never cached
 *
 * `isAdminSession()` is both locks — the ADMIN role and the allowlisted
 * address. The response is `private, no-store`: it carries member email
 * addresses, support-request subjects and revenue, and a shared cache in front
 * of that is a cross-account leak. Same rule `/api/analytics/summary` follows
 * for platform scope.
 *
 * Note this endpoint deliberately does NOT check the admin device cookie. The
 * device gate is a navigation control enforced in middleware for `/admin/*`
 * (see `src/middleware.ts`); an API route under `/api` is not covered by that
 * matcher, and adding a second, partial copy of the rule here would be the
 * kind of hand-aligned duplicate this codebase has been bitten by. What
 * protects this route is the session, which is the same thing protecting every
 * other admin API route.
 */
export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.id || !isAdminSession(session)) {
    // 403 rather than an empty snapshot: empty reads as "the platform is
    // quiet", which is a claim, and the wrong one.
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  // Polled by an open console, so the bucket is per-admin and generous enough
  // for a 20s cadence with a little slack, and small enough that a runaway
  // client cannot sit on the database.
  const rateLimit = await consumeRateLimit(`admin-pulse:${session.user.id}`, {
    limit: 30,
    windowMs: 60_000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests.' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
    );
  }

  const url = new URL(request.url);
  const requested = url.searchParams.get('range');
  const range: AnalyticsRange = isAnalyticsRange(requested) ? requested : '30d';

  try {
    const snapshot = await getAdminPulse(range);
    return NextResponse.json(snapshot, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    log.error('[api/admin/pulse]', error instanceof Error ? error : { error: String(error) });
    return NextResponse.json({ error: 'Could not read the platform snapshot.' }, { status: 500 });
  }
}

import { NextResponse, NextRequest } from 'next/server';
import { requireAdminApi } from '@/lib/admin-api';
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
 * `requireAdminApi()` is all three locks — the ADMIN role, the allowlisted
 * address, and the registered admin device (row 513). The response is
 * `private, no-store`: it carries member email addresses, support-request
 * subjects and revenue, and a shared cache in front of that is a
 * cross-account leak. Same rule the analytics engine (`analytics-metrics.ts`)
 * follows for platform scope.
 *
 * This used to skip the device check on the reasoning that a second copy of
 * the rule would drift. The device gate on `/admin` pages lives in the admin
 * LAYOUT, not in middleware (whose matcher excludes `/api`), so no copy
 * reached this route at all; `requireAdminApi` is the one shared
 * implementation, and the console's fetches carry the device cookie because
 * it is set at path `/`.
 */
export async function GET(request: NextRequest) {
  // 403 rather than an empty snapshot: empty reads as "the platform is
  // quiet", which is a claim, and the wrong one.
  const { session, response } = await requireAdminApi(request);
  if (!session) return response;

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

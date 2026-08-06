import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isAdminSession } from '@/lib/permissions';
import { consumeRateLimit } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';
import { log } from '@/lib/logger';
import {
  type AnalyticsAudience,
  type AnalyticsRange,
  deltaPercent,
  isAnalyticsRange,
} from '@/lib/analytics-engine';
import { getAnalytics, type AnalyticsScope } from '@/lib/analytics-metrics';

export const dynamic = 'force-dynamic';

/**
 * `GET /api/analytics/summary?audience=&range=&profileId=`
 *
 * The engine's audience-scoped read. One endpoint serves a fan, an artist, a
 * venue and an advertiser, because the metric catalogue already knows which
 * figures belong to each — see `metricsForAudience`.
 *
 * ## Scope is derived from the session, never from the request
 *
 * The caller says which AUDIENCE they want, and the server decides whether
 * they hold it and what it resolves to. A client-supplied scope would be a
 * straightforward IDOR: pass someone else's userId and read their listening
 * history, or another artist's page and read their unpublished figures.
 *
 * `profileId` is the one identifier a caller may pass, and it is checked for
 * ownership before it is used. Anything it cannot prove is a 403, not an empty
 * result — an empty result reads as "you have no data", which is a different
 * and misleading claim.
 *
 * Platform scope is admin-only.
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Login required.' }, { status: 401 });
  }
  const userId = session.user.id;

  const rl = await consumeRateLimit(`analytics-summary:${readClientAddress(request)}`, {
    limit: 60,
    windowMs: 60 * 1000,
  });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const rawRange = searchParams.get('range');
  const range: AnalyticsRange = isAnalyticsRange(rawRange) ? rawRange : '30d';
  const rawAudience = searchParams.get('audience') ?? 'fan';
  const profileId = searchParams.get('profileId');

  try {
    let audience: AnalyticsAudience;
    let scope: AnalyticsScope;

    switch (rawAudience) {
      case 'fan': {
        // Always available: every account is a fan, which is the whole point
        // of the fan-first signup.
        audience = 'fan';
        scope = { kind: 'user', userId };
        break;
      }
      case 'artist':
      case 'venue': {
        if (!profileId) {
          return NextResponse.json({ error: 'profileId is required for this audience.' }, { status: 400 });
        }
        // Ownership, checked server-side. `ownerId` is the authorization —
        // holding the id is not.
        const profile = await db.profile.findFirst({
          where: { id: profileId, ownerId: userId },
          select: { id: true, type: true },
        });
        if (!profile) {
          return NextResponse.json({ error: 'Not your page.' }, { status: 403 });
        }
        const expected = rawAudience === 'artist' ? 'ARTIST' : 'VENUE';
        if (profile.type !== expected) {
          return NextResponse.json({ error: 'That page is not of the requested type.' }, { status: 400 });
        }
        audience = rawAudience;
        scope = { kind: 'profile', profileId: profile.id };
        break;
      }
      case 'advertiser': {
        const advertiser = await db.advertiserAccount.findUnique({
          where: { userId },
          select: { userId: true },
        });
        if (!advertiser) {
          return NextResponse.json({ error: 'No advertiser account.' }, { status: 403 });
        }
        audience = 'advertiser';
        scope = { kind: 'advertiser', userId };
        break;
      }
      case 'platform': {
        if (!isAdminSession(session)) {
          return NextResponse.json({ error: 'Admin only.' }, { status: 403 });
        }
        audience = 'platform';
        scope = { kind: 'platform' };
        break;
      }
      default:
        return NextResponse.json({ error: 'Unknown audience.' }, { status: 400 });
    }

    const { range: resolved, metrics } = await getAnalytics(audience, scope, range);

    return NextResponse.json(
      {
        audience,
        range: { range: resolved.range, days: resolved.days, start: resolved.start, end: resolved.end },
        metrics: metrics.map((metric) => ({
          id: metric.id,
          label: metric.label,
          help: metric.help,
          unit: metric.unit,
          value: metric.value,
          previous: metric.previous,
          deltaPercent: deltaPercent(metric.value, metric.previous),
        })),
      },
      // Private and uncached: these figures are scoped to one account, and a
      // shared cache in front of them would be a cross-account leak.
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    log.error('[api/analytics/summary]', error instanceof Error ? error : { error: String(error) }, 'error');
    return NextResponse.json({ error: 'Analytics are temporarily unavailable.' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isAdminSession } from '@/lib/permissions';
import { getHealthSnapshot } from '@/lib/health';
import { verifyBearerToken } from '@/lib/secret-compare';
import { log } from '@/lib/logger';
import { readRuntimeEnv } from '@/lib/runtime-env';

export const dynamic = 'force-dynamic';

// Public callers get no operational detail beyond ok/degraded, but the
// status itself must stay truthful — a hardcoded 200 here previously let a
// sitewide DB outage pass every post-deploy smoke check and every
// third-party uptime monitor (neither sends the CRON_SECRET bearer token),
// which is exactly how a real production outage went undetected for a day.
// Run one cheap real query and report honestly instead of trusting that
// the process is up.
async function publicLivenessResponse() {
  try {
    await db.user.count();
    return NextResponse.json(
      { status: 'ok', scope: 'liveness' },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, max-age=15, stale-while-revalidate=30',
        },
      },
    );
  } catch {
    return NextResponse.json(
      { status: 'degraded', scope: 'liveness' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const hasValidBearer = verifyBearerToken(
      request.headers.get('authorization'),
      readRuntimeEnv('CRON_SECRET'),
    );

    if (!hasValidBearer) {
      const cookieHeader = request.headers.get('cookie') ?? '';
      const mayHaveSession = /(?:^|;\s*)(?:__Secure-)?authjs\.session-token=/.test(cookieHeader);
      if (!mayHaveSession) return await publicLivenessResponse();

      const session = await auth();
      if (!isAdminSession(session)) return await publicLivenessResponse();
    }

    const snapshot = await getHealthSnapshot();
    return NextResponse.json(snapshot, {
      status: snapshot.status === 'ok' ? 200 : 503,
      headers: { 'Cache-Control': 'no-store, private' },
    });
  } catch (error) {
    log.error('[api/health]', error instanceof Error ? error : { error: String(error) }, 'error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

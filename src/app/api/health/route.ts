import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isAdminSession } from '@/lib/permissions';
import { getHealthSnapshot } from '@/lib/health';
import { verifyBearerToken } from '@/lib/secret-compare';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Allow CRON_SECRET bearer token (for monitoring / cron callers) or an admin session.
    const hasValidBearer = verifyBearerToken(request.headers.get('authorization'), process.env.CRON_SECRET);
    if (!hasValidBearer) {
      const session = await auth();
      if (!isAdminSession(session)) {
        // Public callers get no operational detail, but the status itself must
        // be truthful: a hardcoded 200 here let a sitewide DB outage pass every
        // post-deploy smoke check. Run one cheap real query and report honestly.
        try {
          await db.user.count();
          return NextResponse.json(
            { status: 'ok', database: { ok: true } },
            { status: 200, headers: { 'Cache-Control': 'no-store' } }
          );
        } catch {
          return NextResponse.json(
            { status: 'degraded', database: { ok: false } },
            { status: 503, headers: { 'Cache-Control': 'no-store' } }
          );
        }
      }
    }

    const snapshot = await getHealthSnapshot();

    return NextResponse.json(snapshot, {
      status: snapshot.status === 'ok' ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store'
      }
    });
  } catch (err) {
    console.error('[api/health] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

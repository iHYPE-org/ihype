import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isAdminSession } from '@/lib/permissions';
import { getHealthSnapshot } from '@/lib/health';
import { verifyBearerToken } from '@/lib/secret-compare';

export const dynamic = 'force-dynamic';

function publicLivenessResponse() {
  return NextResponse.json(
    { status: 'ok', scope: 'liveness' },
    {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=15, stale-while-revalidate=30',
      },
    },
  );
}

export async function GET(request: NextRequest) {
  try {
    const hasValidBearer = verifyBearerToken(
      request.headers.get('authorization'),
      process.env.CRON_SECRET,
    );

    if (!hasValidBearer) {
      const cookieHeader = request.headers.get('cookie') ?? '';
      const mayHaveSession = /(?:^|;\s*)(?:__Secure-)?authjs\.session-token=/.test(cookieHeader);
      if (!mayHaveSession) return publicLivenessResponse();

      const session = await auth();
      if (!isAdminSession(session)) return publicLivenessResponse();
    }

    const snapshot = await getHealthSnapshot();
    return NextResponse.json(snapshot, {
      status: snapshot.status === 'ok' ? 200 : 503,
      headers: { 'Cache-Control': 'no-store, private' },
    });
  } catch (error) {
    console.error('[api/health] error', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isAdminSession } from '@/lib/permissions';
import { getHealthSnapshot } from '@/lib/health';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Allow CRON_SECRET bearer token (for monitoring / cron callers) or an admin session.
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization') ?? '';
  const bearerToken = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';

  const hasValidBearer = cronSecret && bearerToken && bearerToken === cronSecret;
  if (!hasValidBearer) {
    const session = await auth();
    if (!isAdminSession(session)) {
      return NextResponse.json({ status: 'ok' }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
    }
  }

  const snapshot = await getHealthSnapshot();

  return NextResponse.json(snapshot, {
    status: snapshot.status === 'ok' ? 200 : 503,
    headers: {
      'Cache-Control': 'no-store'
    }
  });
}

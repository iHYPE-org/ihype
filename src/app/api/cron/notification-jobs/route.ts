import { NextResponse, type NextRequest } from 'next/server';
import { isCronRequestAuthorized } from '@/lib/cron-auth';
import { processNotificationJobs } from '@/lib/notification-jobs';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({ ok: true, ...(await processNotificationJobs(25)) });
}

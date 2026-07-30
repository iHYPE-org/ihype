import { NextResponse, type NextRequest } from 'next/server';
import { isCronRequestAuthorized } from '@/lib/cron-auth';
import { processNotificationJobs } from '@/lib/notification-jobs';
import { pingCronAlive } from '@/lib/cron-health';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await processNotificationJobs(25);
  await pingCronAlive('notification-jobs', 30 * 60);
  return NextResponse.json({ ok: true, ...result });
}

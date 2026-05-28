import { NextRequest, NextResponse } from 'next/server';
import { sendDigestsToAllEligibleUsers, sendWeeklyDigest } from '@/lib/email-digest';
import { isCronRequestAuthorized } from '@/lib/cron-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/digest
 * Trigger weekly digest emails. Requires Bearer CRON_SECRET.
 * Body (optional): { userId: string } to send digest to a single user.
 */
export async function POST(request: NextRequest) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { userId?: string } = {};
  try {
    body = (await request.json()) as { userId?: string };
  } catch {
    // empty body is fine
  }

  try {
    if (body.userId) {
      const result = await sendWeeklyDigest(body.userId);
      return NextResponse.json(result);
    }
    const summary = await sendDigestsToAllEligibleUsers();
    return NextResponse.json(summary);
  } catch (error) {
    return NextResponse.json(
      { error: 'Digest failed.' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/digest
 * Used by cron scheduler (GET requests). Same auth as POST.
 */
export async function GET(request: NextRequest) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const summary = await sendDigestsToAllEligibleUsers();
    return NextResponse.json(summary);
  } catch (error) {
    return NextResponse.json(
      { error: 'Digest failed.' },
      { status: 500 }
    );
  }
}

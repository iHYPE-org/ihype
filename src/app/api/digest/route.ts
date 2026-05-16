import { NextRequest, NextResponse } from 'next/server';
import { sendDigestsToAllEligibleUsers, sendWeeklyDigest } from '@/lib/email-digest';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/digest
 * Trigger weekly digest emails. Requires Bearer CRON_SECRET.
 * Body (optional): { userId: string } to send digest to a single user.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
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
      { error: error instanceof Error ? error.message : 'Digest failed' },
      { status: 500 }
    );
  }
}

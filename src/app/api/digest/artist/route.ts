import { NextRequest, NextResponse } from 'next/server';
import { sendArtistWeeklyDigest } from '@/lib/artist-digest';
import { isCronRequestAuthorized } from '@/lib/cron-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  return runDigest(request);
}

export async function POST(request: NextRequest) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  return runDigest(request);
}

async function runDigest(request: NextRequest) {
  let profileId: string | undefined;
  try {
    const body = (await request.json()) as { profileId?: string };
    profileId = body.profileId;
  } catch {
    // ignore — body optional
  }

  if (profileId) {
    await sendArtistWeeklyDigest(profileId);
    return NextResponse.json({ ok: true, sent: 1 });
  }

  const { db } = await import('@/lib/db');
  const profiles = await db.profile.findMany({
    where: { type: { in: ['ARTIST', 'DJ'] } },
    select: { id: true }
  });

  let sent = 0;
  for (const p of profiles) {
    try {
      await sendArtistWeeklyDigest(p.id);
      sent++;
    } catch {
      // continue
    }
  }

  return NextResponse.json({ ok: true, sent });
}

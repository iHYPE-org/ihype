import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { recordAuditEvent } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  let body: { profileId?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    // ignore
  }

  const profileId = typeof body.profileId === 'string' ? body.profileId : '';
  if (!profileId) return NextResponse.json({ error: 'profileId required.' }, { status: 400 });

  const profile = await db.profile.findUnique({
    where: { id: profileId },
    select: { id: true, ownerId: true, isVerified: true, verificationRequested: true }
  });
  if (!profile) return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });
  if (profile.ownerId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  if (profile.isVerified) {
    return NextResponse.json({ error: 'Already verified.' }, { status: 400 });
  }
  if (profile.verificationRequested) {
    return NextResponse.json({ error: 'Verification already requested.' }, { status: 400 });
  }

  await db.profile.update({
    where: { id: profileId },
    data: { verificationRequested: true }
  });

  await recordAuditEvent({
    actorUserId: session.user.id,
    action: 'verification_requested',
    entityType: 'profile',
    entityId: profileId
  });

  return NextResponse.json({ ok: true });
}

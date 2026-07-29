import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Marks a profile's onboarding wizard as finished.
 *
 * Called by the artist/DJ/venue wizards when they reach their done step —
 * including when the user got there via a Skip button. Skipping an optional
 * step is still finishing; treating it as incomplete would turn Skip into a
 * trap that prompts the user forever.
 *
 * Deliberately not part of /api/profile-editor: that route takes arbitrary
 * profile content, and this needs to stay a single narrow write that a client
 * can fire without assembling a payload.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  let body: { profileId?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const profileId = typeof body.profileId === 'string' ? body.profileId : '';
  if (!profileId) {
    return NextResponse.json({ error: 'profileId required.' }, { status: 400 });
  }

  // Ownership and the first-write-wins guard both live in the WHERE, so this
  // is one atomic statement rather than a read, a check, and a write that
  // another request could interleave with. `onboardedAt: null` means a repeat
  // call — a refresh on the done screen, a second pass through the wizard —
  // cannot move the original timestamp.
  //
  // Note this deliberately has no admin bypass, unlike the sibling profile
  // routes: "I finished my setup" is not an assertion anyone can make on
  // someone else's behalf.
  const result = await db.profile.updateMany({
    where: { id: profileId, ownerId: session.user.id, onboardedAt: null },
    data: { onboardedAt: new Date() },
  });

  if (result.count > 0) {
    return NextResponse.json({ ok: true, alreadyOnboarded: false });
  }

  // Zero rows means one of three things, and they need different answers:
  // the profile is already onboarded (fine, idempotent), it belongs to someone
  // else (403), or it does not exist (404).
  const profile = await db.profile.findUnique({
    where: { id: profileId },
    select: { ownerId: true, onboardedAt: true },
  });
  if (!profile) return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });
  if (profile.ownerId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  return NextResponse.json({ ok: true, alreadyOnboarded: true });
}

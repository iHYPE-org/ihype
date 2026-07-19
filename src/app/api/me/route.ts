import { NextResponse } from 'next/server';
import { recordAuditEvent } from '@/lib/audit';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true, name: true, email: true, username: true, role: true,
      isEighteenOrOlder: true, emailVerified: true,
      notificationPreference: {
        select: {
          newShows: true, journalPosts: true, milestones: true, weeklyDigest: true,
          radioLive: true, crateUploads: true, bookingRequests: true,
        },
      },
    },
  });

  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // The "Show me in discovery" toggle lives on Profile (a user can own
  // several), not User — surface the first ARTIST/DJ/VENUE profile's value
  // here so /settings' single unified page doesn't need a second fetch.
  // Fan-only accounts have nothing to toggle (LISTENER profiles never
  // appear in /discover), so this is simply omitted for them.
  const creatorProfile = await db.profile.findFirst({
    where: { ownerId: session.user.id, type: { in: ['ARTIST', 'DJ', 'VENUE'] } },
    select: { id: true, discoverable: true },
  });

  return NextResponse.json({ ...user, creatorProfile });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: {
    name?: string;
    attestEighteenOrOlder?: boolean;
    discoverable?: boolean;
    notificationPreference?: {
      newShows: boolean; journalPosts: boolean; milestones: boolean; weeklyDigest: boolean;
      radioLive?: boolean; crateUploads?: boolean; bookingRequests?: boolean;
    };
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const updates: { name?: string; isEighteenOrOlder?: boolean } = {};
  if (typeof body.name === 'string') updates.name = body.name.trim().slice(0, 100);
  // One-way: the 18+ attestation can only be set, never cleared.
  if (body.attestEighteenOrOlder === true) updates.isEighteenOrOlder = true;

  await db.user.update({ where: { id: session.user.id }, data: updates });

  if (typeof body.discoverable === 'boolean') {
    const creatorProfile = await db.profile.findFirst({
      where: { ownerId: session.user.id, type: { in: ['ARTIST', 'DJ', 'VENUE'] } },
      select: { id: true },
    });
    if (creatorProfile) {
      await db.profile.update({ where: { id: creatorProfile.id }, data: { discoverable: body.discoverable } });
    }
  }

  if (updates.isEighteenOrOlder) {
    // Age attestations need a compliance trail — record who attested and when.
    await recordAuditEvent({
      actorUserId: session.user.id,
      action: 'age_attested_eighteen',
      entityType: 'user',
      entityId: session.user.id,
    }).catch(() => {});
  }

  if (body.notificationPreference) {
    const { newShows, journalPosts, milestones, weeklyDigest, radioLive, crateUploads, bookingRequests } = body.notificationPreference;
    await db.notificationPreference.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id, newShows, journalPosts, milestones, weeklyDigest,
        radioLive: radioLive ?? true, crateUploads: crateUploads ?? true, bookingRequests: bookingRequests ?? true,
      },
      update: {
        newShows, journalPosts, milestones, weeklyDigest,
        ...(radioLive !== undefined && { radioLive }),
        ...(crateUploads !== undefined && { crateUploads }),
        ...(bookingRequests !== undefined && { bookingRequests }),
      },
    });
  }

  return NextResponse.json({ ok: true });
}

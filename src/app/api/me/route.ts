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
      isEighteenOrOlder: true, emailVerified: true, stripeCustomerId: true,
      notificationPreference: {
        select: {
          newShows: true, milestones: true, weeklyDigest: true,
          crateUploads: true, bookingRequests: true,
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
    where: { ownerId: session.user.id, type: { in: ['ARTIST', 'VENUE'] } },
    // Ordered, and the same in GET and PATCH (row 513): unordered, the toggle
    // could read one profile and write another.
    orderBy: { createdAt: 'asc' },
    select: { id: true, discoverable: true },
  });

  // Every user (any profile type, including plain fans) has a personal
  // /invite/[hexId] link — the same identifier /api/register's ref-based
  // invite-gate bypass and the referral-crediting logic in
  // registration-post-processing.ts already resolve against.
  const inviteProfile = await db.profile.findFirst({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: 'asc' },
    select: { hexId: true, id: true, stripeConnectAccountId: true, stripeConnectOnboarded: true },
  });

  const { stripeCustomerId, ...safeUser } = user;
  return NextResponse.json({
    ...safeUser,
    creatorProfile,
    inviteHexId: inviteProfile?.hexId ?? null,
    /* Money methods for Settings (owner, 2026-08-24: "Settings needs payment
       method AND payout method"). Payment method = a Stripe customer with a
       saved card exists (the setup Checkout writes it); payout method = the
       first profile's Connect state — not gated on role, because payables
       from the retired promoter share (orders before 2026-09-25) can still
       sit on a fan's profile. The raw
       Stripe ids stay server-side. */
    payment: { saved: Boolean(stripeCustomerId) },
    payout: inviteProfile
      ? { profileId: inviteProfile.id, connected: Boolean(inviteProfile.stripeConnectOnboarded), started: Boolean(inviteProfile.stripeConnectAccountId) }
      : null,
  });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: {
    name?: string;
    attestEighteenOrOlder?: boolean;
    discoverable?: boolean;
    notificationPreference?: {
      newShows: boolean; milestones: boolean; weeklyDigest: boolean;
      crateUploads?: boolean; bookingRequests?: boolean;
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
      where: { ownerId: session.user.id, type: { in: ['ARTIST', 'VENUE'] } },
    // Ordered, and the same in GET and PATCH (row 513): unordered, the toggle
    // could read one profile and write another.
    orderBy: { createdAt: 'asc' },
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
    const { newShows, milestones, weeklyDigest, crateUploads, bookingRequests } = body.notificationPreference;
    /* `journalPosts` is deliberately neither read nor written: its row is gone
       and nothing sends against it, so a stored value stays exactly as the
       member last left it and a new row takes the column's default. */
    await db.notificationPreference.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id, newShows, milestones, weeklyDigest,
        crateUploads: crateUploads ?? true, bookingRequests: bookingRequests ?? true,
      },
      update: {
        newShows, milestones, weeklyDigest,
        ...(crateUploads !== undefined && { crateUploads }),
        ...(bookingRequests !== undefined && { bookingRequests }),
      },
    });
  }

  return NextResponse.json({ ok: true });
}

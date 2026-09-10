import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { notifyUser } from '@/lib/notify';
import { bookingInboxPath } from '@/lib/booking-inbox-path';
import { log } from '@/lib/logger';
import { consumeRateLimit, rateLimitKey } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const profiles = await db.profile.findMany({
    where: { ownerId: session.user.id },
    select: { id: true },
  });
  if (!profiles.length) return NextResponse.json({ received: [], sent: [] });

  const [received, sent] = await Promise.all([
    db.bookingRequest.findMany({
      where: { toProfileId: { in: profiles.map(p => p.id) } },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        id: true, message: true, status: true, createdAt: true,
        fromUser: {
          select: {
            name: true, username: true,
            // The requester's own performer profile, if they have one —
            // lets the inbox link to "View profile" without exposing email.
            profiles: { where: { type: 'ARTIST' }, select: { slug: true, type: true, genres: true, city: true }, take: 1 },
          },
        },
        toProfile: { select: { name: true, type: true } },
      },
    }),
    db.bookingRequest.findMany({
      where: { fromUserId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true, message: true, status: true, createdAt: true,
        toProfile: { select: { name: true, type: true } },
      },
    }),
  ]);

  return NextResponse.json({ received, sent });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // One pending request per target was the only limit; unlimited targets was
  // an inbox-spam and stats-inflation path (second security scan, 2026-09-02).
  const rl = await consumeRateLimit(rateLimitKey('booking-request', session.user.id, null), { limit: 20, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) return NextResponse.json({ error: 'Too many booking requests — try again later.' }, { status: 429 });

  const body = await request.json().catch(() => null);
  const { toProfileId, message } = body ?? {};
  if (typeof toProfileId !== 'string' || typeof message !== 'string' || !message.trim() || message.length > 4000) {
    return NextResponse.json({ error: 'toProfileId and message (up to 4000 characters) are required' }, { status: 400 });
  }

  const profile = await db.profile.findUnique({ where: { id: toProfileId }, select: { id: true, ownerId: true, name: true, slug: true, type: true } });
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  const existing = await db.bookingRequest.findFirst({
    where: { fromUserId: session.user.id, toProfileId, status: 'pending' },
    select: { id: true },
  });
  if (existing) return NextResponse.json({ error: 'You already have a pending request to this profile' }, { status: 409 });

  const req = await db.bookingRequest.create({
    data: { fromUserId: session.user.id, toProfileId, message: String(message).slice(0, 1000) },
    select: { id: true, status: true, createdAt: true },
  });

  /* THE OFFER USED TO REACH NOBODY (2026-09-10). A venue sends this from the
     demand radar and saw "Request sent"; the row was created and nothing was
     notified, no email, no push, no in-app notice. The recipient's only clue
     was an unlinked count on their dashboard, and seven days later
     `close-stale-bookings` flipped it to `expired` telling neither party.
     Best-effort: an offer that was accepted into the database must not fail
     because a notification did. */
  /* `bookingRequests` is the Settings toggle named for exactly this notice,
     and nothing read it until 2026-09-10 — a recipient who switched "Booking
     requests" off went on getting them. Unreadable preference means SEND: the
     offer reaching its recipient is the point of row 383, and a failed
     preference read must not silently mute a venue's inbox. */
  const wantsBookingNotices =
    profile.ownerId
      ? (await db.notificationPreference
          .findUnique({ where: { userId: profile.ownerId }, select: { bookingRequests: true } })
          .catch(() => null))?.bookingRequests !== false
      : false;
  if (profile.ownerId && profile.ownerId !== session.user.id && wantsBookingNotices) {
    await notifyUser(profile.ownerId, {
      type: 'booking-request',
      title: 'A booking request',
      body: `${profile.name} has a new booking request waiting for a reply.`,
      link: bookingInboxPath(profile.type, profile.slug),
    }).catch((err) => log.error('[booking-requests]', err instanceof Error ? err : { error: String(err) }, 'request created but the recipient was not notified'));
  }

  return NextResponse.json({ request: req }, { status: 201 });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const { id, status } = body ?? {};
  if (!id || !['accepted', 'declined'].includes(status)) {
    return NextResponse.json({ error: 'id and status (accepted|declined) required' }, { status: 400 });
  }

  const br = await db.bookingRequest.findUnique({
    where: { id },
    select: { fromUserId: true, toProfile: { select: { ownerId: true, name: true } } },
  });
  if (!br) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (br.toProfile.ownerId !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const updated = await db.bookingRequest.update({ where: { id }, data: { status } });

  /* And the answer has to travel back. The sender pressed a button in the
     demand radar and, before this, learned the outcome only by returning to
     a list they had no reason to revisit. */
  if (br.fromUserId && br.fromUserId !== session.user.id) {
    await notifyUser(br.fromUserId, {
      type: `booking-${status}`,
      title: status === 'accepted' ? 'Your booking request was accepted' : 'Your booking request was declined',
      body: `${br.toProfile.name} ${status} your booking request.`,
      link: '/app/me/booking',
    }).catch((err) => log.error('[booking-requests]', err instanceof Error ? err : { error: String(err) }, 'reply recorded but the sender was not notified'));
  }

  return NextResponse.json({ request: updated });
}

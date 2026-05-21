import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { consumeRateLimit } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';
import { sendGenericEmail } from '@/lib/mailer';
import { getBaseUrl } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const ip = readClientAddress(request);
  const rl = await consumeRateLimit(`booking-request:${session.user.id}`, { limit: 10, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 });
  }

  let body: { toProfileId?: string; message?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }); }
  const { toProfileId, message } = body;
  const trimmedMessage = message?.trim() ?? '';
  if (!toProfileId || !trimmedMessage) {
    return NextResponse.json({ error: 'toProfileId and message are required.' }, { status: 400 });
  }
  if (trimmedMessage.length < 10) {
    return NextResponse.json({ error: 'Message must be at least 10 characters.' }, { status: 400 });
  }
  if (trimmedMessage.length > 2000) {
    return NextResponse.json({ error: 'Message must be 2000 characters or fewer.' }, { status: 400 });
  }

  const profile = await db.profile.findUnique({
    where: { id: toProfileId },
    select: { id: true, name: true, ownerId: true, contactInfo: true, owner: { select: { email: true } } }
  });
  if (!profile) {
    return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });
  }

  const bookingRequest = await db.bookingRequest.create({
    data: { fromUserId: session.user.id, toProfileId, message: trimmedMessage }
  });

  // Create notification for artist
  await db.notification.create({
    data: {
      userId: profile.ownerId,
      type: 'booking_request',
      body: `New booking request from ${session.user.name ?? 'a user'}.`,
      link: `/home?tab=bookings`
    }
  });

  // Send email to artist
  if (profile.owner.email) {
    await sendGenericEmail({
      to: profile.owner.email,
      subject: `New booking request on iHYPE`,
      text: `You have a new booking request for ${profile.name}.\n\nMessage: ${trimmedMessage}\n\nLog in to review it: ${getBaseUrl()}/home?tab=bookings`,
      html: `<p>You have a new booking request for <strong>${profile.name}</strong>.</p><p><em>${trimmedMessage}</em></p><p><a href="${getBaseUrl()}/home?tab=bookings">Review it on iHYPE</a></p>`
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, bookingRequest }, { status: 201 });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  // Get profiles owned by this user
  const myProfiles = await db.profile.findMany({
    where: { ownerId: session.user.id },
    select: { id: true }
  });
  const myProfileIds = myProfiles.map((p) => p.id);

  const [incoming, sent] = await Promise.all([
    db.bookingRequest.findMany({
      where: { toProfileId: { in: myProfileIds } },
      orderBy: { createdAt: 'desc' },
      include: { fromUser: { select: { id: true, name: true, email: true } }, toProfile: { select: { id: true, name: true, slug: true } } }
    }),
    db.bookingRequest.findMany({
      where: { fromUserId: session.user.id },
      orderBy: { createdAt: 'desc' },
      include: { toProfile: { select: { id: true, name: true, slug: true } } }
    })
  ]);

  return NextResponse.json({ incoming, sent });
}

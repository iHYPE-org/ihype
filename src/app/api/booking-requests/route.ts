import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

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
            profiles: { where: { type: { in: ['ARTIST', 'DJ'] } }, select: { slug: true, type: true, genres: true, city: true }, take: 1 },
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

  const body = await request.json().catch(() => null);
  const { toProfileId, message } = body ?? {};
  if (!toProfileId || !message?.trim()) {
    return NextResponse.json({ error: 'toProfileId and message are required' }, { status: 400 });
  }

  const profile = await db.profile.findUnique({ where: { id: toProfileId }, select: { id: true } });
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
    select: { toProfile: { select: { ownerId: true } } },
  });
  if (!br) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (br.toProfile.ownerId !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const updated = await db.bookingRequest.update({ where: { id }, data: { status } });
  return NextResponse.json({ request: updated });
}

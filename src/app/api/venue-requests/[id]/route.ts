import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { canManageOwnedResource } from '@/lib/permissions';
import { notifyUser } from '@/lib/notify';

const schema = z.object({
  status: z.enum(['BOOKED', 'DISMISSED'])
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Login required' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = schema.parse(await request.json());

    const connectionRequest = await db.venueConnectionRequest.findUnique({
      where: { id },
      include: {
        venueProfile: {
          select: {
            ownerId: true,
            name: true,
            slug: true,
          }
        }
      }
    });

    if (!connectionRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    if (!canManageOwnedResource(session, connectionRequest.venueProfile.ownerId)) {
      return NextResponse.json({ error: 'Only the venue owner can update this request' }, { status: 403 });
    }

    const updatedRequest = await db.venueConnectionRequest.update({
      where: { id },
      data: {
        status: body.status,
        respondedAt: new Date()
      }
    });

    if (body.status === 'BOOKED') {
      /* The venue booked the ACT, not one fan's row. Every other pending ask
         for the same act at this venue is answered by the same decision, so it
         leaves the radar too, and every fan who ticked "tell me if they book
         them" hears about it. `notifyOnBooking` had been collected since the
         column existed and read by nothing until 2026-09-01. */
      const sameAct = connectionRequest.artistProfileId
        ? { artistProfileId: connectionRequest.artistProfileId }
        : { artistProfileId: null, artistName: { equals: connectionRequest.artistName.trim(), mode: 'insensitive' as const } };
      const siblings = await db.venueConnectionRequest.findMany({
        where: { venueProfileId: connectionRequest.venueProfileId, status: 'PENDING', id: { not: id }, ...sameAct },
        select: { id: true },
      }).catch(() => []);
      if (siblings.length > 0) {
        await db.venueConnectionRequest.updateMany({
          where: { id: { in: siblings.map((row) => row.id) } },
          data: { status: 'BOOKED', respondedAt: new Date() },
        }).catch(() => null);
      }
      const toTell = await db.venueConnectionRequest.findMany({
        where: { venueProfileId: connectionRequest.venueProfileId, status: 'BOOKED', notifyOnBooking: true, ...sameAct },
        select: { requesterId: true },
        distinct: ['requesterId'],
        take: 500,
      }).catch(() => []);
      const venue = connectionRequest.venueProfile;
      await Promise.all(toTell.map((row) => notifyUser(row.requesterId, {
        type: 'ask-booked',
        title: `${venue.name} booked ${connectionRequest.artistName}`,
        body: `You asked for this. Keep an eye on ${venue.name}'s calendar for the date.`,
        link: `/app/venues/${venue.slug}`,
      })));
    }

    return NextResponse.json(updatedRequest);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? 'Invalid request' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Could not update this request' }, { status: 500 });
  }
}

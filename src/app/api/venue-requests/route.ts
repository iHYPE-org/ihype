import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { consumeRateLimit, rateLimitKey } from '@/lib/rate-limit';

const schema = z.object({
  venueProfileId: z.string().cuid(),
  requesterType: z.enum(['LISTENER', 'PROMOTER']),
  artistProfileId: z.string().cuid().optional(),
  artistName: z.string().trim().max(120).optional(),
  note: z.string().trim().max(500).optional(),
  notifyOnBooking: z.boolean().default(false)
}).refine((value) => value.artistProfileId || value.artistName, {
  message: 'Select an artist profile or enter an artist/band name.',
  path: ['artistName']
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Login required' }, { status: 401 });
  }

  const rl = await consumeRateLimit(
    rateLimitKey('venue-request', session.user.id, request.headers.get('x-forwarded-for')),
    { limit: 20, windowMs: 60 * 60 * 1000 }
  );
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 });
  }

  try {
    const body = schema.parse(await request.json());

    const venueProfile = await db.profile.findUnique({
      where: { id: body.venueProfileId },
      select: { id: true, type: true }
    });

    if (!venueProfile || venueProfile.type !== 'VENUE') {
      return NextResponse.json({ error: 'Venue page not found' }, { status: 404 });
    }

    let artistProfileName: string | null = null;

    if (body.artistProfileId) {
      const artistProfile = await db.profile.findUnique({
        where: { id: body.artistProfileId },
        select: { id: true, name: true, type: true }
      });

      if (!artistProfile || !['ARTIST', 'DJ'].includes(artistProfile.type)) {
        return NextResponse.json({ error: 'Choose an artist or promoter profile' }, { status: 400 });
      }

      artistProfileName = artistProfile.name;
    }

    const normalizedArtistName = (body.artistName || artistProfileName || '').trim().toLowerCase();
    const existingPendingRequests = await db.venueConnectionRequest.findMany({
      where: {
        venueProfileId: body.venueProfileId,
        requesterId: session.user.id,
        status: 'PENDING'
      },
      select: {
        artistProfileId: true,
        artistName: true
      }
    });

    const isDuplicate = existingPendingRequests.some((connectionRequest) => {
      if (body.artistProfileId && connectionRequest.artistProfileId === body.artistProfileId) {
        return true;
      }

      return connectionRequest.artistName.trim().toLowerCase() === normalizedArtistName;
    });

    if (isDuplicate) {
      return NextResponse.json(
        { error: 'You already sent a pending recommendation for this artist to this venue.' },
        { status: 409 }
      );
    }

    const connectionRequest = await db.venueConnectionRequest.create({
      data: {
        venueProfileId: body.venueProfileId,
        artistProfileId: body.artistProfileId,
        requesterId: session.user.id,
        requesterType: body.requesterType,
        artistName: body.artistName || artistProfileName || 'Unknown artist',
        note: body.note || undefined,
        notifyOnBooking: body.notifyOnBooking
      }
    });

    return NextResponse.json(connectionRequest, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? 'Invalid request' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Could not save this recommendation' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { consumeRateLimit, rateLimitKey } from '@/lib/rate-limit';
import { detectRequestLocation } from '@/lib/request-location';
import { log } from '@/lib/logger';
import { notifyUser } from '@/lib/notify';

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

const MAX_OPEN_ASKS_PER_ACT = 5;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const venueProfiles = await db.profile.findMany({
    where: { ownerId: session.user.id, type: 'VENUE' },
    select: { id: true },
  });
  if (!venueProfiles.length) return NextResponse.json({ requests: [] });

  const requests = await db.venueConnectionRequest.findMany({
    where: { venueProfileId: { in: venueProfiles.map(p => p.id) }, status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, artistName: true, note: true, requesterType: true, createdAt: true, status: true,
      artistProfile: { select: { slug: true } },
    },
  });

  return NextResponse.json({ requests });
}

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
      select: { id: true, type: true, name: true, ownerId: true }
    });

    if (!venueProfile || venueProfile.type !== 'VENUE') {
      return NextResponse.json({ error: 'Venue page not found' }, { status: 404 });
    }

    let artistProfileName: string | null = null;
    let artistProfileId = body.artistProfileId;
    let artistOwner: { ownerId: string; slug: string } | null = null;

    if (artistProfileId) {
      const artistProfile = await db.profile.findUnique({
        where: { id: artistProfileId },
        select: { id: true, name: true, type: true, ownerId: true, slug: true }
      });

      if (!artistProfile || !['ARTIST'].includes(artistProfile.type)) {
        return NextResponse.json({ error: 'Choose an artist profile' }, { status: 400 });
      }

      artistProfileName = artistProfile.name;
      artistOwner = { ownerId: artistProfile.ownerId, slug: artistProfile.slug };
    } else if (body.artistName) {
      /* The form asks for "Artist name or iHYPE handle" and sent only text, so
         a fan typing @handle or an exact name got a request attached to NO
         profile — it never reached the artist's stats and the venue's radar
         could not match it to an act it knows. Resolve it here: an exact slug
         (with or without the @) or an exact, case-insensitive name. Anything
         looser would attach a fan's request to the wrong artist. */
      const handle = body.artistName.replace(/^@/, '').trim().toLowerCase();
      const matched = handle
        ? await db.profile.findFirst({
            where: {
              type: 'ARTIST',
              OR: [{ slug: handle }, { name: { equals: body.artistName.trim(), mode: 'insensitive' } }],
            },
            select: { id: true, name: true, ownerId: true, slug: true },
          }).catch(() => null)
        : null;
      if (matched) {
        artistProfileId = matched.id;
        artistProfileName = matched.name;
        artistOwner = { ownerId: matched.ownerId, slug: matched.slug };
      }
    }

    /* Where the fan is, captured once. Their own profile location first (the
       address they chose to give), else the request's edge geolocation. This
       is what lets the venue's radar weigh a request by whether the fan could
       actually attend; see `fan-demand.ts`. Never fatal — a request with no
       location is stored with none and weighs as unknown. */
    const requesterProfile = await db.profile.findFirst({
      where: { ownerId: session.user.id, OR: [{ latitude: { not: null } }, { city: { not: null } }] },
      orderBy: { createdAt: 'asc' },
      select: { city: true, stateRegion: true, latitude: true, longitude: true },
    }).catch(() => null);
    const edge = requesterProfile ? null : await detectRequestLocation().catch((error) => {
      log.warn('[venue-requests]', { error: error instanceof Error ? error.message : String(error) }, 'Location detection failed; request stored without a location');
      return null;
    });
    const requesterLocation = {
      requesterCity: requesterProfile?.city ?? edge?.city ?? null,
      requesterStateRegion: requesterProfile?.stateRegion ?? edge?.stateRegion ?? null,
      requesterLatitude: requesterProfile?.latitude ?? edge?.latitude ?? null,
      requesterLongitude: requesterProfile?.longitude ?? edge?.longitude ?? null,
    };

    const normalizedArtistName = (body.artistName || artistProfileName || '').trim().toLowerCase();

    /* One fan, one act, at most MAX_OPEN_ASKS_PER_ACT venues at a time. Every
       ask counts toward the artist's Requests figure and toward the fan's own
       recommendations, so without a ceiling one fan could inflate both by
       asking every room in the state. Five is enough to ask a real touring
       radius; a venue answering frees a slot. Dismissed and booked asks do not
       count — they are answered. */
    const openForAct = await db.venueConnectionRequest.count({
      where: {
        requesterId: session.user.id,
        status: 'PENDING',
        ...(artistProfileId
          ? { artistProfileId }
          : { artistProfileId: null, artistName: { equals: normalizedArtistName, mode: 'insensitive' } }),
      },
    }).catch(() => 0);
    if (openForAct >= MAX_OPEN_ASKS_PER_ACT) {
      return NextResponse.json(
        { error: `You already have ${MAX_OPEN_ASKS_PER_ACT} open asks for this act. When a venue answers one, you can ask another.` },
        { status: 429 }
      );
    }

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
      if (artistProfileId && connectionRequest.artistProfileId === artistProfileId) {
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
        artistProfileId,
        requesterId: session.user.id,
        requesterType: body.requesterType,
        artistName: artistProfileName || body.artistName || 'Unknown artist',
        note: body.note || undefined,
        notifyOnBooking: body.notifyOnBooking,
        ...requesterLocation,
      }
    });

    /* Tell the two people this is about. Until 2026-09-01 a request landed in
       a table and stayed there: the venue found out only by visiting the
       radar, and the artist never found out at all. `notifyUser` is in-app +
       push and never throws; neither notice goes to the requester themselves
       (a venue owner asking their own room is not news to them). */
    const actName = artistProfileName || body.artistName || 'an act';
    if (venueProfile.ownerId !== session.user.id) {
      await notifyUser(venueProfile.ownerId, {
        type: 'venue-request',
        title: 'A fan wants an act booked',
        body: `A fan asked you to book ${actName}. It is ranked on your demand radar.`,
        link: '/app/me/booking',
      });
    }
    if (artistOwner && artistOwner.ownerId !== session.user.id) {
      await notifyUser(artistOwner.ownerId, {
        type: 'fan-demand',
        title: 'Fans want you somewhere',
        body: `A fan asked ${venueProfile.name} to book you.`,
        link: `/app/me/artists/${artistOwner.slug}/analytics`,
      });
    }

    return NextResponse.json(connectionRequest, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? 'Invalid request' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Could not save this recommendation' }, { status: 500 });
  }
}

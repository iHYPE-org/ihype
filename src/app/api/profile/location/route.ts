import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordAuditEvent } from '@/lib/audit';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { canManageOwnedResource } from '@/lib/permissions';

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(''));

const latitudeField = z.preprocess(
  (value) => {
    if (value === '' || value === null || value === undefined) return null;
    if (typeof value === 'string') return Number(value.trim());
    return value;
  },
  z.number().finite().min(-90).max(90).nullable()
);

const longitudeField = z.preprocess(
  (value) => {
    if (value === '' || value === null || value === undefined) return null;
    if (typeof value === 'string') return Number(value.trim());
    return value;
  },
  z.number().finite().min(-180).max(180).nullable()
);

const schema = z
  .object({
    profileId: z.string().cuid(),
    addressLine1: optionalText(200),
    city: optionalText(120),
    stateRegion: optionalText(120),
    postalCode: optionalText(32),
    country: optionalText(120),
    latitude: latitudeField,
    longitude: longitudeField
  })
  .refine((value) => (value.latitude == null) === (value.longitude == null), {
    message: 'Latitude and longitude must be saved together.'
  });

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Login required' }, { status: 401 });
  }

  try {
    const body = schema.parse(await request.json());

    const profile = await db.profile.findUnique({
      where: { id: body.profileId },
      select: { id: true, ownerId: true, type: true }
    });

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    if (profile.type !== 'VENUE') {
      return NextResponse.json({ error: 'Directions can only be configured for venue profiles.' }, { status: 400 });
    }

    if (!canManageOwnedResource(session, profile.ownerId)) {
      return NextResponse.json({ error: 'Only the venue owner can edit this location.' }, { status: 403 });
    }

    const updatedProfile = await db.profile.update({
      where: { id: profile.id },
      data: {
        addressLine1: body.addressLine1 || null,
        city: body.city || null,
        stateRegion: body.stateRegion || null,
        postalCode: body.postalCode || null,
        country: body.country || null,
        latitude: body.latitude,
        longitude: body.longitude
      },
      select: {
        id: true,
        addressLine1: true,
        city: true,
        stateRegion: true,
        postalCode: true,
        country: true,
        latitude: true,
        longitude: true
      }
    });

    await recordAuditEvent({
      actorUserId: session.user.id,
      action: 'venue_location_updated',
      entityType: 'profile',
      entityId: profile.id,
      metadata: {
        changedFields: ['addressLine1', 'city', 'stateRegion', 'postalCode', 'country', 'latitude', 'longitude']
      }
    });

    return NextResponse.json({ profile: updatedProfile });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? 'Invalid venue location.' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Could not update venue location.' }, { status: 500 });
  }
}

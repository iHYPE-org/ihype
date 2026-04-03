import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { sortShowsForFeed } from '@/lib/integrity';
import { canManageOwnedResource, isAdminSession } from '@/lib/permissions';
import { showProductionPlanSchema } from '@/lib/show-composer';
import { DEFAULT_PROMOTER_AFFILIATE_PERCENT, validateTicketSplit } from '@/lib/ticketing';
import { slugify } from '@/lib/utils';

const schema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  status: z.enum(['DRAFT', 'SCHEDULED', 'LIVE']).default('SCHEDULED'),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().optional(),
  venueProfileId: z.string().cuid().optional(),
  headlinerProfileId: z.string().cuid().optional(),
  promoterProfileId: z.string().cuid().optional(),
  isTicketed: z.boolean().default(false),
  ticketingOpensAt: z.string().datetime().optional(),
  bookingLegalNotes: z.string().optional(),
  ticketPriceCents: z.coerce.number().int().nonnegative().optional(),
  ticketCapacity: z.coerce.number().int().positive().optional(),
  venuePayoutPercent: z.coerce.number().int().min(0).max(95).optional(),
  artistPayoutPercent: z.coerce.number().int().min(0).max(95).optional(),
  promoterPayoutPercent: z.coerce.number().int().min(0).max(10).optional(),
  tags: z.array(z.string()).default([]),
  productionPlan: showProductionPlanSchema.optional()
});

export async function GET() {
  const shows = await db.show.findMany({
    include: { venueProfile: true, headlinerProfile: true },
    where: { status: { in: ['SCHEDULED', 'LIVE', 'ENDED'] } }
  });
  return NextResponse.json(sortShowsForFeed(shows));
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Login required' }, { status: 401 });
  }
  const isAdmin = isAdminSession(session);

  try {
    const body = schema.parse(await request.json());
    const [venueProfile, headlinerProfile, promoterProfile] = await Promise.all([
      body.venueProfileId
        ? db.profile.findUnique({
            where: { id: body.venueProfileId }
          })
        : Promise.resolve(null),
      body.headlinerProfileId
        ? db.profile.findUnique({
            where: { id: body.headlinerProfileId }
          })
        : Promise.resolve(null),
      body.promoterProfileId
        ? db.profile.findUnique({
            where: { id: body.promoterProfileId }
          })
        : Promise.resolve(null)
    ]);

    if (body.venueProfileId) {
      if (!venueProfile || venueProfile.type !== 'VENUE') {
        return NextResponse.json({ error: 'Venue profile not found' }, { status: 404 });
      }

      if (!canManageOwnedResource(session, venueProfile.ownerId)) {
        return NextResponse.json({ error: 'Only the venue owner can schedule events for this venue' }, { status: 403 });
      }
    }

    if (body.headlinerProfileId && (!headlinerProfile || !['ARTIST', 'DJ'].includes(headlinerProfile.type))) {
      return NextResponse.json({ error: 'Headliner must be an artist or promoter profile' }, { status: 400 });
    }

    if (body.promoterProfileId && (!promoterProfile || promoterProfile.type !== 'DJ')) {
      return NextResponse.json({ error: 'Promoter must be a promoter profile' }, { status: 400 });
    }

    if (
      body.promoterProfileId &&
      !isAdmin &&
      promoterProfile?.ownerId !== session.user.id &&
      !body.venueProfileId
    ) {
      return NextResponse.json({ error: 'Only the promoter owner can create streaming shows from this promoter page' }, { status: 403 });
    }

    if (body.productionPlan && !body.promoterProfileId) {
      return NextResponse.json({ error: 'A promoter profile is required when saving a production plan' }, { status: 400 });
    }

    if (body.isTicketed) {
      if (!body.ticketPriceCents || !body.ticketCapacity) {
        return NextResponse.json({ error: 'Ticket price and capacity are required for ticketed events' }, { status: 400 });
      }

      if (body.venuePayoutPercent === undefined || body.artistPayoutPercent === undefined) {
        return NextResponse.json(
          { error: 'Venue and artist payout percentages are required for ticketed events' },
          { status: 400 }
        );
      }

      const promoterPayoutPercent =
        body.promoterPayoutPercent ?? DEFAULT_PROMOTER_AFFILIATE_PERCENT;

      try {
        validateTicketSplit({
          venuePayoutPercent: body.venuePayoutPercent,
          artistPayoutPercent: body.artistPayoutPercent,
          promoterPayoutPercent
        });
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Invalid payout split' },
          { status: 400 }
        );
      }
    }

    const baseSlug = slugify(body.title);
    const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`;

    const show = await db.show.create({
      data: {
        slug,
        title: body.title,
        description: body.description,
        startsAt: new Date(body.startsAt),
        endsAt: body.endsAt ? new Date(body.endsAt) : undefined,
        creatorId: session.user.id,
        venueProfileId: body.venueProfileId,
        headlinerProfileId: body.headlinerProfileId,
        promoterProfileId: body.promoterProfileId,
        tags: body.tags,
        ticketingOpensAt: body.isTicketed && body.ticketingOpensAt ? new Date(body.ticketingOpensAt) : null,
        bookingLegalNotes: body.bookingLegalNotes,
        isTicketed: body.isTicketed,
        ticketPriceCents: body.isTicketed ? body.ticketPriceCents : 0,
        ticketCapacity: body.isTicketed ? body.ticketCapacity : null,
        venuePayoutPercent: body.isTicketed ? body.venuePayoutPercent : null,
        artistPayoutPercent: body.isTicketed ? body.artistPayoutPercent : null,
        promoterPayoutPercent: body.isTicketed ? body.promoterPayoutPercent ?? DEFAULT_PROMOTER_AFFILIATE_PERCENT : DEFAULT_PROMOTER_AFFILIATE_PERCENT,
        productionPlan: body.productionPlan,
        status: body.status
      }
    });

    return NextResponse.json(show, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid show payload' }, { status: 400 });
  }
}

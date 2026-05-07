import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { sortShowsForFeed } from '@/lib/integrity';
import { canManageOwnedResource, isAdminSession } from '@/lib/permissions';
import { showProductionPlanSchema } from '@/lib/show-composer';
import { DEFAULT_PROMOTER_AFFILIATE_PERCENT, validateTicketSplit } from '@/lib/ticketing';
import { slugify } from '@/lib/utils';
import { consumeRateLimit, rateLimitHeaders, rateLimitKey } from '@/lib/rate-limit';

const radioTrackSchema = z.object({
  hexId: z.string(),
  title: z.string(),
  artistName: z.string(),
  artistProfileSlug: z.string().optional(),
  position: z.number().int().nonnegative()
});

const schema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  // isRadioShow=true → curated stream show; no venue/tickets required; startsAt defaults to now
  isRadioShow: z.boolean().default(false),
  status: z.enum(['DRAFT', 'SCHEDULED', 'LIVE']).default('SCHEDULED'),
  startsAt: z.string().datetime().optional(),
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
  // For radio shows: tracks stored here; for live shows: production plan
  radioTracks: z.array(radioTrackSchema).optional(),
  productionPlan: showProductionPlanSchema.optional()
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mine = searchParams.get('mine') === '1' || searchParams.get('mine') === 'true';

  // ?mine=1 — return authenticated user's own shows (all statuses including DRAFT)
  if (mine) {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Login required' }, { status: 401 });
    }
    const shows = await db.show.findMany({
      include: { venueProfile: true, headlinerProfile: true, promoterProfile: true },
      where: { creatorId: session.user.id },
      orderBy: [{ createdAt: 'desc' }]
    });
    return NextResponse.json(shows);
  }

  // Public feed — scheduled / live / ended only
  const shows = await db.show.findMany({
    include: { venueProfile: true, headlinerProfile: true, promoterProfile: true },
    where: { status: { in: ['SCHEDULED', 'LIVE', 'ENDED'] } }
  });
  return NextResponse.json(sortShowsForFeed(shows));
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Login required' }, { status: 401 });
  }
  const isAdmin = isAdminSession(session);

  // 10 show creations per hour per user — prevents automated abuse
  const rl = await consumeRateLimit(
    rateLimitKey('show-create', session.user.id, request.headers.get('x-forwarded-for')),
    { limit: 10, windowMs: 60 * 60_000 }
  );
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many show creation requests. Try again later.' },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  try {
    const body = schema.parse(await request.json());

    // ── Radio show: validate track list, skip venue/ticket checks ─
    if (body.isRadioShow) {
      const tracks = body.radioTracks ?? [];
      if (tracks.length === 0) {
        return NextResponse.json({ error: 'A radio show needs at least one track.' }, { status: 400 });
      }
      if (tracks.length > 50) {
        return NextResponse.json({ error: 'A radio show can have at most 50 tracks.' }, { status: 400 });
      }

      // Verify all referenced tracks exist and have freeUseEnabled
      const hexIds = tracks.map(t => t.hexId);
      const assets = await db.artistMediaAsset.findMany({
        where: { hexId: { in: hexIds }, freeUseEnabled: true },
        select: { hexId: true }
      });
      const validHexIds = new Set(assets.map(a => a.hexId));
      const invalid = hexIds.filter(h => !validHexIds.has(h));
      if (invalid.length > 0) {
        return NextResponse.json(
          { error: `${invalid.length} track(s) are not in the free-use catalogue.` },
          { status: 400 }
        );
      }

      const sortedTracks = [...tracks].sort((a, b) => a.position - b.position);
      const baseSlug = slugify(body.title);
      const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`;

      const show = await db.show.create({
        data: {
          slug,
          title: body.title,
          description: body.description,
          isRadioShow: true,
          startsAt: new Date(),
          creatorId: session.user.id,
          promoterProfileId: body.promoterProfileId ?? null,
          tags: [...body.tags, 'radio-show'],
          productionPlan: {
            kind: 'radio',
            tracks: sortedTracks
          },
          status: body.status === 'LIVE' ? 'LIVE' : body.status === 'DRAFT' ? 'DRAFT' : 'LIVE'
        }
      });

      return NextResponse.json(show, { status: 201 });
    }

    // ── Live event: existing validation path ──────────────────────
    if (!body.startsAt) {
      return NextResponse.json({ error: 'A start date/time is required for live events.' }, { status: 400 });
    }

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
        startsAt: new Date(body.startsAt!),
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
        status: body.status,
        ...(body.productionPlan?.advertising !== undefined && {
          advertisingConfig: {
            create: {
              enabled: body.productionPlan.advertising.enabled ?? true,
              scope: body.productionPlan.advertising.scope ?? 'local',
              frequency: body.productionPlan.advertising.frequency ?? 3
            }
          }
        })
      }
    });

    return NextResponse.json(show, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid show payload' }, { status: 400 });
  }
}

import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db, withDbRetry } from '@/lib/db';
import { sortShowsForFeed } from '@/lib/integrity';
import { canManageOwnedResource, isAdminSession } from '@/lib/permissions';
import { getDemoCreatorExclusion } from '@/lib/runtime-flags';
import { showProductionPlanSchema } from '@/lib/show-composer';
import { DEFAULT_PROMOTER_AFFILIATE_PERCENT, validateTicketSplit } from '@/lib/ticketing';
import { slugify } from '@/lib/utils';
import { consumeRateLimit, rateLimitHeaders, rateLimitKey } from '@/lib/rate-limit';
import { sanitizeShowInput } from '@/lib/sanitize';
import { checkContent } from '@/lib/auto-mod';
import { readClientAddress } from '@/lib/request-meta';

const radioTrackSchema = z.object({
  hexId: z.string().min(1),
  title: z.string().min(1),
  artistName: z.string().min(1),
  artistProfileSlug: z.string().optional(),
  position: z.number().int().nonnegative()
});

const schema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
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
  radioTracks: z.array(radioTrackSchema).optional(),
  productionPlan: showProductionPlanSchema.optional()
});

function isUniqueSlugViolation(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') return false;
  const target = error.meta?.target;
  if (Array.isArray(target)) return target.includes('slug');
  return typeof target === 'string' ? target.includes('slug') : true;
}

// The pre-check + create is racy: two concurrent creates can both pass the
// findUnique check and pick the same slug, so the loser's P2002 gets retried
// with a fresh suffix instead of surfacing as "Invalid show payload".
async function createShowWithUniqueSlug<T>(title: string, create: (slug: string) => Promise<T>): Promise<T> {
  const baseSlug = slugify(title);
  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`;
    if (await db.show.findUnique({ where: { slug }, select: { id: true } })) continue;
    try {
      return await create(slug);
    } catch (error) {
      if (!isUniqueSlugViolation(error)) throw error;
      lastError = error;
    }
  }
  throw lastError ?? new Error('Could not allocate a unique show slug');
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mine = searchParams.get('mine') === '1' || searchParams.get('mine') === 'true';
  const radioOnly = searchParams.get('radioShows') === '1' || searchParams.get('radioShows') === 'true';

  if (mine) {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Login required' }, { status: 401 });
    }

    const profileSelect = { select: { id: true, name: true, slug: true, type: true, avatarImage: true, city: true, stateRegion: true } };
    const shows = await db.show.findMany({
      include: { venueProfile: profileSelect, headlinerProfile: profileSelect, promoterProfile: profileSelect },
      where: { creatorId: session.user.id, ...(radioOnly ? { isRadioShow: true } : {}) },
      orderBy: [{ createdAt: 'desc' }],
      take: 200
    });
    return NextResponse.json(shows);
  }

  if (radioOnly) {
    const profileSelect = { select: { id: true, name: true, slug: true, type: true, avatarImage: true, city: true, stateRegion: true } };
    const shows = await db.show.findMany({
      include: {
        venueProfile: profileSelect,
        headlinerProfile: { select: { ...profileSelect.select, genres: true } },
        promoterProfile: profileSelect,
        // Powers /radio's up-next crate and real show durations — all public
        // fields already displayed on the show detail page.
        radioTracks: {
          select: { id: true, title: true, artistName: true, position: true, durationSecs: true },
          orderBy: { position: 'asc' as const },
        },
      },
      where: { isRadioShow: true, status: { in: ['SCHEDULED', 'LIVE', 'ENDED'] }, ...getDemoCreatorExclusion() },
      orderBy: [{ startsAt: 'desc' }],
      take: 50,
    });
    return NextResponse.json(shows, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120' }
    });
  }

  const profileSelect = { select: { id: true, name: true, slug: true, type: true, avatarImage: true, city: true, stateRegion: true } };
  const shows = await db.show.findMany({
    include: { venueProfile: profileSelect, headlinerProfile: profileSelect, promoterProfile: profileSelect },
    where: {
      status: { in: ['SCHEDULED', 'LIVE', 'ENDED'] },
      ...getDemoCreatorExclusion()
    },
    // Without an explicit order, Postgres returns an *arbitrary* 200 rows —
    // recent shows would randomly vanish from the feed as the table grows.
    orderBy: [{ startsAt: 'desc' }],
    take: 200
  });
  return NextResponse.json(sortShowsForFeed(shows), {
    headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120' }
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Login required' }, { status: 401 });
  }
  const isAdmin = isAdminSession(session);

  // 10 show creations per hour per user — prevents automated abuse
  const rl = await consumeRateLimit(
    rateLimitKey('show-create', session.user.id, readClientAddress(request)),
    { limit: 10, windowMs: 60 * 60_000 }
  );
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many show creation requests. Try again later.' },
      { status: 429, headers: rateLimitHeaders(rl) }
    );
  }

  try {
    const rawBody = await request.json();
    sanitizeShowInput(rawBody as Record<string, unknown>);
    const body = schema.parse(rawBody);

    const modCheck = checkContent(`${body.title} ${body.description ?? ''}`);
    const moderationStatus = modCheck.flagged ? 'FLAGGED' : 'APPROVED';

    if (body.isRadioShow && body.productionPlan) {
      // Rich production-plan path (Radio Show Creator) — an alternate,
      // additive way to create a radio show alongside the legacy flat
      // radioTracks path below. Requires an owned DJ promoter profile, same
      // as the ticketed-show productionPlan rule further down.
      if (!body.promoterProfileId) {
        return NextResponse.json({ error: 'A promoter profile is required when saving a production plan' }, { status: 400 });
      }

      const promoterProfile = await db.profile.findUnique({ where: { id: body.promoterProfileId } });
      if (!promoterProfile || promoterProfile.type !== 'DJ') {
        return NextResponse.json({ error: 'Promoter must be a promoter profile' }, { status: 400 });
      }

      if (!isAdmin && promoterProfile.ownerId !== session.user.id) {
        return NextResponse.json({ error: 'Only the promoter owner can create radio shows from this promoter page' }, { status: 403 });
      }

      const status = body.status === 'DRAFT' ? 'DRAFT' : 'SCHEDULED';

      const show = await createShowWithUniqueSlug(body.title, (slug) => db.show.create({
        data: {
          slug,
          title: body.title,
          description: body.description,
          isRadioShow: true,
          startsAt: body.startsAt ? new Date(body.startsAt) : new Date(),
          creatorId: session.user.id,
          promoterProfileId: body.promoterProfileId,
          tags: Array.from(new Set([...body.tags, 'radio-show', 'prerecorded-show'])),
          productionPlan: body.productionPlan,
          status,
          moderationStatus
        }
      }));

      return NextResponse.json(show, { status: 201 });
    }

    if (body.isRadioShow) {
      const tracks = body.radioTracks ?? [];
      if (!tracks.length) {
        return NextResponse.json({ error: 'A radio show needs at least one track.' }, { status: 400 });
      }

      if (tracks.length > 50) {
        return NextResponse.json({ error: 'A radio show can have at most 50 tracks.' }, { status: 400 });
      }

      const promoterProfile = body.promoterProfileId
        ? await db.profile.findUnique({ where: { id: body.promoterProfileId } })
        : null;

      if (body.promoterProfileId && (!promoterProfile || promoterProfile.type !== 'DJ')) {
        return NextResponse.json({ error: 'Promoter must be a promoter profile' }, { status: 400 });
      }

      if (
        body.promoterProfileId &&
        !isAdmin &&
        promoterProfile?.ownerId !== session.user.id
      ) {
        return NextResponse.json({ error: 'Only the promoter owner can create radio shows from this promoter page' }, { status: 403 });
      }

      const hexIds = tracks.map((track) => track.hexId);
      const assets = await db.artistMediaAsset.findMany({
        where: { hexId: { in: hexIds }, freeUseEnabled: true },
        select: { hexId: true }
      });
      const validHexIds = new Set(assets.map((asset) => asset.hexId));
      const invalidTracks = hexIds.filter((hexId) => !validHexIds.has(hexId));

      if (invalidTracks.length) {
        return NextResponse.json(
          { error: `${invalidTracks.length} track(s) are not in the free-use catalogue.` },
          { status: 400 }
        );
      }

      const status = body.status === 'DRAFT' ? 'DRAFT' : 'SCHEDULED';
      const sortedTracks = [...tracks].sort((left, right) => left.position - right.position);

      const show = await createShowWithUniqueSlug(body.title, (slug) => db.show.create({
        data: {
          slug,
          title: body.title,
          description: body.description,
          isRadioShow: true,
          startsAt: new Date(),
          creatorId: session.user.id,
          promoterProfileId: body.promoterProfileId ?? null,
          tags: Array.from(new Set([...body.tags, 'radio-show', 'prerecorded-show'])),
          productionPlan: {
            kind: 'radio',
            tracks: sortedTracks
          },
          status,
          moderationStatus
        }
      }));

      return NextResponse.json(show, { status: 201 });
    }

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
    const canManageVenueProfile = Boolean(
      venueProfile && canManageOwnedResource(session, venueProfile.ownerId)
    );
    const canManagePromoterProfile = Boolean(
      promoterProfile && (isAdmin || promoterProfile.ownerId === session.user.id)
    );
    const isPromoterVenueDraft = Boolean(
      body.venueProfileId &&
        body.status === 'DRAFT' &&
        !body.isTicketed &&
        canManagePromoterProfile
    );

    if (body.venueProfileId) {
      if (!venueProfile || venueProfile.type !== 'VENUE') {
        return NextResponse.json({ error: 'Venue profile not found' }, { status: 404 });
      }

      if (!canManageVenueProfile && !isPromoterVenueDraft) {
        return NextResponse.json(
          { error: 'Only the venue owner can schedule events for this venue. Promoters can save draft event requests for venue review.' },
          { status: 403 }
        );
      }
    }

    if (body.headlinerProfileId && (!headlinerProfile || !['ARTIST', 'DJ'].includes(headlinerProfile.type))) {
      return NextResponse.json({ error: 'Headliner must be an artist or promoter profile' }, { status: 400 });
    }

    if (body.promoterProfileId && (!promoterProfile || promoterProfile.type !== 'DJ')) {
      return NextResponse.json({ error: 'Promoter must be a promoter profile' }, { status: 400 });
    }

    if (body.promoterProfileId && !canManagePromoterProfile && !canManageVenueProfile) {
      return NextResponse.json(
        { error: 'Only the promoter owner or venue owner can attach this promoter profile to a show' },
        { status: 403 }
      );
    }

    if (body.productionPlan && !body.promoterProfileId) {
      return NextResponse.json({ error: 'A promoter profile is required when saving a production plan' }, { status: 400 });
    }

    if (body.isTicketed) {
      if (body.venueProfileId && !canManageVenueProfile) {
        return NextResponse.json({ error: 'Only the venue owner can open ticketing for venue events' }, { status: 403 });
      }

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
          { error: 'Invalid payout split configuration.' },
          { status: 400 }
        );
      }
    }

    const show = await createShowWithUniqueSlug(body.title, (slug) => withDbRetry(() => db.show.create({
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
        moderationStatus,
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
    })));

    return NextResponse.json(show, { status: 201 });
  } catch (err) {
    console.error('[shows]', err);
    const msg = err instanceof Error && (err.message.includes('unavailable') || err.message.includes('timeout') || err.message.includes('connect'))
      ? 'Database unavailable — please try again in a moment.'
      : 'Invalid show payload';
    const status = msg.includes('Database') ? 503 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}

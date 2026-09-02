import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { getDemoCreatorExclusion } from '@/lib/runtime-flags';
import { showProductionPlanSchema } from '@/lib/show-composer';
import { resolveAdBreakClips } from '@/lib/ad-clip-selection';
import { z } from 'zod';
import { checkContent } from '@/lib/auto-mod';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ showId: string }> }
) {
  const { showId } = await params;

  if (!showId) {
    return NextResponse.json({ error: 'Show ID or slug is required.' }, { status: 400 });
  }

  const show = await db.show.findFirst({
    where: {
      OR: [{ slug: showId }, { id: showId }],
      status: { in: ['SCHEDULED', 'LIVE', 'ENDED'] },
      ...getDemoCreatorExclusion()
    },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      status: true,
      startsAt: true,
      endsAt: true,
      isRadioShow: true,
      isTicketed: true,
      ticketPriceCents: true,
      ticketCapacity: true,
      ticketsSoldCount: true,
      ticketingOpensAt: true,
      bookingLegalNotes: true,
      hypeCount: true,
      tags: true,
      productionPlan: true,
      posterImage: true,
      venuePayoutPercent: true,
      artistPayoutPercent: true,
      promoterPayoutPercent: true,
      venueProfile: { select: { name: true, slug: true, city: true, stateRegion: true, country: true } },
      headlinerProfile: { select: { name: true, slug: true, type: true, genres: true, avatarImage: true } },
      promoterProfile: { select: { name: true, slug: true } }
    }
  });

  if (!show) {
    return NextResponse.json({ error: 'Show not found.' }, { status: 404 });
  }

  return NextResponse.json({ show });
}

const patchSchema = z.object({
  status: z.string().max(20).optional(),
  title: z.string().trim().min(3).max(200).optional(),
  description: z.string().trim().max(2000).optional(),
  productionPlan: z.unknown().optional(),
  startsAt: z.string().datetime({ offset: true }).optional(),
});

const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT:      ['SCHEDULED'],
  SCHEDULED:  ['LIVE', 'DRAFT'],
  LIVE:       ['ENDED'],
  ENDED:      [],
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ showId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Login required' }, { status: 401 });

  const { showId } = await params;
  /* Typed and bounded like POST /api/shows (second security scan,
     2026-09-02). This body was a bare cast: a megabyte title, a non-string
     title (a Prisma throw and a 500), an unparseable date, and none of the
     auto-moderation POST runs — and the title is rendered on the public show
     page, the map, search and every ticket email. */
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request.', issues: parsed.error.issues.map((issue) => issue.message) }, { status: 400 });
  }
  const body = parsed.data;
  // Same auto-moderation as POST: flagged copy is stored FLAGGED for review,
  // not refused — the queue decides, exactly as it does for a new show.
  const moderationStatus = body.title !== undefined || body.description !== undefined
    ? (checkContent(`${body.title ?? ''} ${body.description ?? ''}`).flagged ? 'FLAGGED' : undefined)
    : undefined;

  const show = await db.show.findFirst({
    where: { OR: [{ id: showId }, { slug: showId }], creatorId: session.user.id },
    select: { id: true, status: true },
  });
  if (!show) return NextResponse.json({ error: 'Show not found' }, { status: 404 });

  // Draft/schedule edits (title, description, productionPlan, startsAt) — lets
  // a DJ save and re-open a show across sessions before it airs. Only allowed
  // while the show hasn't gone live yet.
  const hasEditFields = body.title !== undefined || body.description !== undefined || body.productionPlan !== undefined || body.startsAt !== undefined;
  if (hasEditFields) {
    if (!['DRAFT', 'SCHEDULED'].includes(show.status)) {
      return NextResponse.json({ error: 'Only draft or scheduled shows can be edited' }, { status: 400 });
    }

    let productionPlan: unknown = body.productionPlan;
    if (productionPlan !== undefined) {
      const parsedPlan = showProductionPlanSchema.safeParse(productionPlan);
      // A plan that does not parse is refused rather than stored as-is — the
      // player resolves whatever is in this column.
      if (!parsedPlan.success) {
        return NextResponse.json({ error: 'productionPlan is not a valid plan.' }, { status: 400 });
      }
      // Same auto-fill as POST /api/shows: a DJ can save with "advertising
      // enabled" on but no clips ever manually confirmed into the timeline,
      // which otherwise leaves the frequency-based ad-break auto-injection
      // with nothing to inject.
      if (parsedPlan.data.advertising.enabled && parsedPlan.data.advertising.clips.length === 0) {
        parsedPlan.data.advertising.clips = await resolveAdBreakClips(parsedPlan.data.advertising.scope);
      }
      productionPlan = parsedPlan.data;
    }

    const updated = await db.show.update({
      where: { id: show.id },
      data: {
        ...(body.title !== undefined && { title: body.title }),
        ...(body.description !== undefined && { description: body.description }),
        ...(moderationStatus ? { moderationStatus } : {}),
        ...(productionPlan !== undefined && { productionPlan: productionPlan as object }),
        ...(body.startsAt !== undefined && { startsAt: new Date(body.startsAt) }),
      },
      select: { id: true, slug: true, status: true },
    });

    if (body.status === undefined) {
      return NextResponse.json({ show: updated });
    }
  }

  const { status: newStatus } = body;
  if (!newStatus) return NextResponse.json({ error: 'status is required' }, { status: 400 });

  const allowed = VALID_TRANSITIONS[show.status] ?? [];
  if (!allowed.includes(newStatus)) {
    return NextResponse.json({ error: `Cannot transition from ${show.status} to ${newStatus}` }, { status: 400 });
  }

  const updated = await db.show.update({
    where: { id: show.id },
    data: { status: newStatus as 'DRAFT' | 'SCHEDULED' | 'LIVE' | 'ENDED' },
    select: { id: true, slug: true, status: true },
  });

  return NextResponse.json({ show: updated });
}

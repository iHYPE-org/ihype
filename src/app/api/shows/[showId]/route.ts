import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { getDemoCreatorExclusion } from '@/lib/runtime-flags';
import { showProductionPlanSchema } from '@/lib/show-composer';
import { resolveAdBreakClips } from '@/lib/ad-clip-selection';
import { z } from 'zod';
import { checkContent } from '@/lib/auto-mod';
import { isShowOrganizer, ORGANIZER_SHOW_SELECT } from '@/lib/show-organizer';
import { notifyUser } from '@/lib/notify';
import { formatDoorTime, isValidTimeZone } from '@/lib/format-locale';

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
  /* Only ever ESTABLISHES a clock, never reassigns one — a show that already
     names its zone keeps it, whoever is editing and wherever they are. */
  timeZone: z.string().refine(isValidTimeZone, 'Unknown time zone').optional(),
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

  /* The organiser set the cancel route and the door already admit — venue
     owner, headliner owner, creator, administrator. Until 2026-09-14 this
     route admitted the creator alone (and nothing called it at all: the edit
     page is the first caller, DESIGN_SYNC row 446), so a venue that could
     cancel a show could not move it. A non-organiser reads 404, not 403, the
     way the cancel page does: the show's existence is not theirs to learn. */
  const show = await db.show.findFirst({
    where: { OR: [{ id: showId }, { slug: showId }] },
    select: { id: true, slug: true, title: true, status: true, startsAt: true, timeZone: true, isTicketed: true, ticketingOpensAt: true, ...ORGANIZER_SHOW_SELECT },
  });
  if (!show || !isShowOrganizer(session, show)) return NextResponse.json({ error: 'Show not found' }, { status: 404 });

  // Edits to title, description, productionPlan and startsAt are allowed
  // while the show has not started — DRAFT or SCHEDULED, the same window the
  // cancel flow uses. Once it is LIVE the ticket is for what was announced.
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
        ...(body.timeZone !== undefined && show.timeZone === null && { timeZone: body.timeZone }),
      },
      select: { id: true, slug: true, status: true },
    });

    /* A moved start time is the one edit a ticket holder has to hear about:
       they bought a night, not a title. Every captured order's buyer gets the
       in-app notice (and push, where registered) with the new time; the show
       page they land on carries the rest. Best-effort AFTER the write, never
       inside it, and a failed notice never undoes or errors a recorded change
       (rows 381-382). Drafts have no buyers, so this is a SCHEDULED-only path
       in practice, and the query says so rather than relying on it. */
    if (body.startsAt !== undefined && show.isTicketed && new Date(body.startsAt).getTime() !== show.startsAt.getTime()) {
      await notifyRescheduled(show.id, updated.slug, body.title ?? show.title, new Date(body.startsAt), show.timeZone ?? body.timeZone ?? null).catch(() => {});
    }

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

  /* Publishing a ticketed show opens its sales in the same write, the way
     the event creator and the lineup lock do (CLAUDE.md, the TicketSaleCard
     row): `ticketingOpensAt` null means NOT on sale, and this transition was
     the one publish path that left it null — a ticketed show flipped
     DRAFT → SCHEDULED here would have been permanently unbuyable. */
  const opensSales = newStatus === 'SCHEDULED' && show.isTicketed && !show.ticketingOpensAt;
  const updated = await db.show.update({
    where: { id: show.id },
    data: {
      status: newStatus as 'DRAFT' | 'SCHEDULED' | 'LIVE' | 'ENDED',
      ...(opensSales ? { ticketingOpensAt: new Date() } : {}),
    },
    select: { id: true, slug: true, status: true },
  });

  return NextResponse.json({ show: updated });
}

/** One notice per buyer with a captured order, whatever the order's quantity. */
async function notifyRescheduled(showId: string, slug: string, title: string, startsAt: Date, timeZone: string | null): Promise<void> {
  const orders = await db.ticketOrder.findMany({
    where: { showId, status: 'CAPTURED', buyerUserId: { not: null } },
    select: { buyerUserId: true },
    distinct: ['buyerUserId'],
  });
  /* A notice about a moved door time is the one message that MUST name its
     clock: it is read hours later, in a push payload, by someone deciding
     whether they can still make it. English here like every other notification
     — the recipient has no stored locale (row 424). */
  const when = formatDoorTime('en', startsAt, timeZone, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  for (const order of orders) {
    if (!order.buyerUserId) continue;
    await notifyUser(order.buyerUserId, {
      type: 'show_rescheduled',
      title: `"${title}" has a new time`,
      body: `The organizer moved "${title}" to ${when} UTC. Your ticket is still valid — open it for the details.`,
      link: `/shows/${slug}`,
    });
  }
}

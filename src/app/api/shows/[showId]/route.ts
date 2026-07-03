import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { getDemoCreatorExclusion } from '@/lib/runtime-flags';

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
  let body: { status?: string; title?: string; description?: string; productionPlan?: unknown; startsAt?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

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

    const updated = await db.show.update({
      where: { id: show.id },
      data: {
        ...(body.title !== undefined && { title: body.title }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.productionPlan !== undefined && { productionPlan: body.productionPlan as object }),
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

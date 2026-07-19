import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { canManageOwnedResource } from '@/lib/permissions';
import { notifyUser } from '@/lib/notify';

export const dynamic = 'force-dynamic';

const slotSchema = z.object({
  profileId: z.string().cuid(),
  splitPercent: z.number().int().min(1).max(100),
  isHeadliner: z.boolean().optional().default(false),
});

const schema = z.object({
  slots: z.array(slotSchema).min(2, 'A lineup split needs at least two acts — a single act just uses the show\'s own artist share.'),
});

/**
 * GET the current lineup proposal for a show — any of the show's own
 * lineup members, the venue owner, or the show's creator can view it (the
 * accept/decline UI needs to render for the specific artist viewing it, but
 * everyone involved should be able to see where things stand).
 */
export async function GET(request: Request, { params }: { params: Promise<{ showId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Login required' }, { status: 401 });

  const { showId } = await params;
  const show = await db.show.findUnique({
    where: { id: showId },
    select: {
      id: true, slug: true, title: true, startsAt: true, status: true,
      artistPayoutPercent: true, venuePayoutPercent: true, promoterPayoutPercent: true,
      venueProfile: { select: { id: true, ownerId: true, name: true } },
    },
  });
  if (!show) return NextResponse.json({ error: 'Show not found' }, { status: 404 });

  const slots = await db.showLineupSlot.findMany({
    where: { showId },
    orderBy: [{ isHeadliner: 'desc' }, { splitPercent: 'desc' }],
    select: {
      id: true, profileId: true, isHeadliner: true, splitPercent: true, status: true, proposedAt: true, respondedAt: true,
      profile: { select: { id: true, slug: true, name: true, type: true, ownerId: true, avatarImage: true } },
    },
  });

  const isVenueOwner = canManageOwnedResource(session, show.venueProfile?.ownerId);
  const myLineupSlot = slots.find((s) => s.profile.ownerId === session.user.id) ?? null;

  if (!isVenueOwner && !myLineupSlot) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json({ show, slots, isVenueOwner, myLineupSlotId: myLineupSlot?.id ?? null });
}

/**
 * POST — the venue proposes (or revises) a show's lineup and per-act split
 * of the artist share. Any call here — first proposal or a revision after a
 * decline — resets every named act's slot back to PENDING, since a change
 * to the split invalidates whatever anyone already accepted; everyone named
 * has to sign off on the current numbers, not stale ones.
 *
 * Per product decision: this only applies to shows with multiple acts —
 * splits are proposed by the venue, accepted or declined by each artist.
 * The show is forced to (or kept at) DRAFT until every slot is ACCEPTED, so
 * it can't go on sale mid-negotiation (src/app/shows/[slug]/page.tsx and the
 * public shows listing already gate on status !== 'DRAFT').
 */
export async function POST(request: Request, { params }: { params: Promise<{ showId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Login required' }, { status: 401 });

  const { showId } = await params;
  const show = await db.show.findUnique({
    where: { id: showId },
    select: {
      id: true, slug: true, title: true, status: true, artistPayoutPercent: true,
      venueProfile: { select: { id: true, ownerId: true, name: true } },
    },
  });
  if (!show) return NextResponse.json({ error: 'Show not found' }, { status: 404 });
  if (!canManageOwnedResource(session, show.venueProfile?.ownerId)) {
    return NextResponse.json({ error: 'Only the venue can propose a lineup split.' }, { status: 403 });
  }
  if (show.status !== 'DRAFT') {
    return NextResponse.json({ error: 'This show is already scheduled — a lineup split can only be proposed while it\'s still a draft.' }, { status: 400 });
  }
  if (show.artistPayoutPercent == null) {
    return NextResponse.json({ error: 'This show has no artist payout percentage set yet.' }, { status: 400 });
  }

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await request.json());
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues[0]?.message ?? 'Invalid lineup payload.' }, { status: 400 });
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const profileIds = body.slots.map((s) => s.profileId);
  if (new Set(profileIds).size !== profileIds.length) {
    return NextResponse.json({ error: 'Each act can only appear once in the lineup.' }, { status: 400 });
  }
  const headlinerCount = body.slots.filter((s) => s.isHeadliner).length;
  if (headlinerCount !== 1) {
    return NextResponse.json({ error: 'Exactly one act must be marked as the headliner.' }, { status: 400 });
  }
  const totalSplit = body.slots.reduce((sum, s) => sum + s.splitPercent, 0);
  if (totalSplit !== show.artistPayoutPercent) {
    return NextResponse.json(
      { error: `The lineup splits must add up to this show's ${show.artistPayoutPercent}% artist share (currently ${totalSplit}%).` },
      { status: 400 },
    );
  }

  const profiles = await db.profile.findMany({
    where: { id: { in: profileIds }, type: { in: ['ARTIST', 'DJ'] } },
    select: { id: true, name: true, ownerId: true },
  });
  if (profiles.length !== profileIds.length) {
    return NextResponse.json({ error: 'One or more acts could not be found.' }, { status: 400 });
  }

  const headlinerProfileId = body.slots.find((s) => s.isHeadliner)!.profileId;

  await db.$transaction(async (tx) => {
    await tx.showLineupSlot.deleteMany({ where: { showId: show.id } });
    await tx.showLineupSlot.createMany({
      data: body.slots.map((s) => ({
        showId: show.id,
        profileId: s.profileId,
        isHeadliner: s.isHeadliner,
        splitPercent: s.splitPercent,
        status: 'PENDING' as const,
      })),
    });
    await tx.show.update({ where: { id: show.id }, data: { headlinerProfileId } });
  });

  await Promise.all(
    profiles.map((p) =>
      notifyUser(p.ownerId, {
        type: 'lineup_split_proposed',
        title: 'New lineup split proposal',
        body: `${show.venueProfile?.name ?? 'A venue'} proposed a split for "${show.title}" — review and accept or decline.`,
        link: `/shows/${show.slug}/lineup`,
      }),
    ),
  );

  return NextResponse.json({ ok: true });
}

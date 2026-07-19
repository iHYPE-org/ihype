import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { notifyUser } from '@/lib/notify';

export const dynamic = 'force-dynamic';

const schema = z.object({
  status: z.enum(['ACCEPTED', 'DECLINED']),
});

/**
 * PATCH — an artist/DJ accepts or declines their own proposed lineup slot.
 * Only the owner of the profile named in the slot can respond for it.
 *
 * Once every slot on a show is ACCEPTED, the booking locks: this route
 * flips the show from DRAFT to SCHEDULED right here, atomically with the
 * accept, so there's no separate "publish" step for the venue to remember —
 * the show goes on sale the instant the last artist signs off, matching
 * the design's "booking locks only once every artist accepts."
 * A DECLINE never advances the show; the venue has to revise and re-propose
 * via POST /api/shows/[showId]/lineup, which resets every slot to PENDING.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ showId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Login required' }, { status: 401 });

  const { showId } = await params;
  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await request.json());
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues[0]?.message ?? 'Invalid response.' }, { status: 400 });
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  // A user can own several profiles (e.g. both an ARTIST and a DJ profile),
  // so resolve every profile they own and match the lineup slot against any
  // of those — not just a single "primary" profile.
  const myProfileIds = (await db.profile.findMany({ where: { ownerId: session.user.id }, select: { id: true } })).map((p) => p.id);
  const myLineupSlot = await db.showLineupSlot.findFirst({
    where: { showId, profileId: { in: myProfileIds } },
  });

  if (!myLineupSlot) {
    return NextResponse.json({ error: 'You do not have a lineup slot on this show.' }, { status: 404 });
  }
  if (myLineupSlot.status !== 'PENDING') {
    return NextResponse.json({ error: `You already ${myLineupSlot.status.toLowerCase()} this slot.` }, { status: 400 });
  }

  const show = await db.show.findUnique({
    where: { id: showId },
    select: { id: true, slug: true, title: true, status: true, venueProfile: { select: { ownerId: true, name: true } } },
  });
  if (!show) return NextResponse.json({ error: 'Show not found' }, { status: 404 });

  const respondedProfile = await db.profile.findUnique({ where: { id: myLineupSlot.profileId }, select: { name: true } });

  await db.showLineupSlot.update({
    where: { id: myLineupSlot.id },
    data: { status: body.status, respondedAt: new Date() },
  });

  if (body.status === 'DECLINED') {
    if (show.venueProfile?.ownerId) {
      await notifyUser(show.venueProfile.ownerId, {
        type: 'lineup_split_declined',
        title: 'Lineup split declined',
        body: `${respondedProfile?.name ?? 'An act'} declined their split for "${show.title}" — revise and re-propose to keep the booking moving.`,
        link: `/shows/${show.slug}/lineup`,
      });
    }
    return NextResponse.json({ ok: true, status: 'DECLINED' });
  }

  // ACCEPTED — check whether every other slot is now also ACCEPTED.
  const remainingSlots = await db.showLineupSlot.findMany({
    where: { showId },
    select: { status: true },
  });
  const allAccepted = remainingSlots.length > 0 && remainingSlots.every((s) => s.status === 'ACCEPTED');

  if (allAccepted && show.status === 'DRAFT') {
    await db.show.update({ where: { id: showId }, data: { status: 'SCHEDULED' } });
    if (show.venueProfile?.ownerId) {
      await notifyUser(show.venueProfile.ownerId, {
        type: 'lineup_split_locked',
        title: 'Lineup locked — booking confirmed',
        body: `Every act accepted their split for "${show.title}" — it's now scheduled and on sale.`,
        link: `/shows/${show.slug}`,
      });
    }
  }

  return NextResponse.json({ ok: true, status: 'ACCEPTED', showLocked: allAccepted });
}

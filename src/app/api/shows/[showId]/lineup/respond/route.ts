import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { notifyUser } from '@/lib/notify';
import { readClientAddress } from '@/lib/request-meta';
import { renderAndHashAgreement } from '@/lib/split-agreement';
import { describePayoutMethod, termsFor } from '@/lib/split-agreement-data';
import { emailSignedAgreement } from '@/lib/split-agreement-copy';

export const dynamic = 'force-dynamic';

const schema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ACCEPTED'),
    /** The SHA-256 of the agreement text the act was shown. */
    agreementHash: z.string().regex(/^[0-9a-f]{64}$/),
    /** The act's signature: the signer's full name, typed. */
    signerName: z.string().trim().min(2).max(120),
  }),
  z.object({ status: z.literal('DECLINED') }),
]);

/**
 * PATCH — an act accepts ("Accept and sign") or declines the venue's Lineup
 * Offer. Accepting is the act's signature on the Show Revenue Split Agreement
 * (src/lib/split-agreement.ts, 11.1): the route re-renders the agreement from
 * the stored offer, and the hash the act was shown must equal both that and
 * the hash the venue signed, or nothing is signed.
 *
 * An act must have recorded where it gets paid before it can sign (5.2), and
 * that method is written into the agreement record.
 *
 * Once every act has signed, the booking locks: a DRAFT show becomes
 * SCHEDULED and sales open, in the same request as the last signature.
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

  // A user can own several profiles, so match the slot against any of them.
  const myProfileIds = (await db.profile.findMany({ where: { ownerId: session.user.id }, select: { id: true } })).map((p) => p.id);
  const myLineupSlot = await db.showLineupSlot.findFirst({
    where: { showId, profileId: { in: myProfileIds } },
    select: {
      id: true, status: true, profileId: true, splitPercent: true, guaranteeCents: true, approvedDeductions: true,
      guarantorName: true, juryWaiver: true, performanceTerms: true, agreementVersion: true, agreementHash: true,
      venueSignerUserId: true, venueSignerName: true, venueSignedAt: true, venueSignerIp: true, venueSignerDevice: true,
      profile: { select: { name: true, payoutMethodKind: true, payoutMethodDetails: true } },
    },
  });

  if (!myLineupSlot) {
    return NextResponse.json({ error: 'You do not have a lineup slot on this show.' }, { status: 404 });
  }
  if (myLineupSlot.status !== 'PENDING') {
    return NextResponse.json({ error: `You already ${myLineupSlot.status.toLowerCase()} this offer.` }, { status: 400 });
  }

  const show = await db.show.findUnique({
    where: { id: showId },
    select: {
      id: true, slug: true, title: true, status: true, startsAt: true, timeZone: true,
      isTicketed: true, ticketPriceCents: true, ticketingOpensAt: true,
      venueProfile: { select: { id: true, ownerId: true, name: true, addressLine1: true, city: true, stateRegion: true, postalCode: true } },
    },
  });
  if (!show || !show.venueProfile) return NextResponse.json({ error: 'Show not found' }, { status: 404 });
  const venue = show.venueProfile;

  if (body.status === 'DECLINED') {
    await db.showLineupSlot.update({ where: { id: myLineupSlot.id }, data: { status: 'DECLINED', respondedAt: new Date() } });
    await notifyUser(venue.ownerId, {
      type: 'lineup_split_declined',
      title: 'Lineup offer declined',
      body: `${myLineupSlot.profile.name} declined the offer for "${show.title}" — revise it and send it again to keep the booking moving.`,
      link: `/app/me/shows/${show.slug}/lineup`,
    }).catch(() => undefined);
    return NextResponse.json({ ok: true, status: 'DECLINED' });
  }

  if (!myLineupSlot.agreementHash || !myLineupSlot.venueSignedAt || !myLineupSlot.venueSignerUserId || !myLineupSlot.venueSignerName) {
    return NextResponse.json({ error: 'This offer has not been signed by the venue. Ask the venue to send it again.' }, { status: 409 });
  }
  const paymentMethod = describePayoutMethod(myLineupSlot.profile.payoutMethodKind, myLineupSlot.profile.payoutMethodDetails);
  if (!paymentMethod) {
    return NextResponse.json(
      { error: 'Add where you get paid before you sign. The venue pays you there.', code: 'PAYOUT_METHOD_REQUIRED' },
      { status: 409 },
    );
  }

  const { version, text, hash } = await renderAndHashAgreement(termsFor({
    show, venue, artistName: myLineupSlot.profile.name, slot: myLineupSlot,
  }));
  /* The venue signed a DIFFERENT text: the offer predates the current
     agreement version (or its terms were rendered differently). Reloading
     cannot fix that — only the venue sending the offer again can, so say so. */
  if (hash !== myLineupSlot.agreementHash) {
    return NextResponse.json(
      { error: 'The split agreement was updated after the venue sent this offer. The venue needs to send the offer again before you can sign it.', code: 'OFFER_OUTDATED' },
      { status: 409 },
    );
  }
  if (hash !== body.agreementHash) {
    return NextResponse.json(
      { error: 'The agreement text changed after you read it. Reload the page and read it again before signing.', code: 'AGREEMENT_CHANGED' },
      { status: 409 },
    );
  }

  const now = new Date();
  const result = await db.$transaction(async (tx) => {
    /* Conditional on PENDING: two taps, or a revision landing between the read
       and here, cannot sign twice or sign a slot the venue just replaced. */
    const flipped = await tx.showLineupSlot.updateMany({
      where: { id: myLineupSlot.id, status: 'PENDING', agreementHash: hash },
      data: { status: 'ACCEPTED', respondedAt: now },
    });
    if (flipped.count !== 1) return null;
    const agreement = await tx.showSplitAgreement.create({
      data: {
        lineupSlotId: myLineupSlot.id,
        showId: show.id,
        venueProfileId: venue.id,
        artistProfileId: myLineupSlot.profileId,
        version,
        textHash: hash,
        text,
        splitPercent: myLineupSlot.splitPercent,
        guaranteeCents: myLineupSlot.guaranteeCents,
        approvedDeductions: myLineupSlot.approvedDeductions ?? undefined,
        guarantorName: myLineupSlot.guarantorName,
        juryWaiver: myLineupSlot.juryWaiver,
        performanceTerms: myLineupSlot.performanceTerms ?? undefined,
        venueSignerUserId: myLineupSlot.venueSignerUserId!,
        venueSignerName: myLineupSlot.venueSignerName!,
        venueSignedAt: myLineupSlot.venueSignedAt!,
        venueSignerIp: myLineupSlot.venueSignerIp,
        venueSignerDevice: myLineupSlot.venueSignerDevice,
        artistSignerUserId: session.user.id,
        artistSignerName: body.signerName,
        artistSignedAt: now,
        artistSignerIp: readClientAddress(request),
        artistSignerDevice: request.headers.get('user-agent')?.slice(0, 300) ?? null,
        artistPaymentMethod: paymentMethod,
        payment: { create: {} },
      },
      select: { id: true },
    });
    const slots = await tx.showLineupSlot.findMany({ where: { showId: show.id }, select: { status: true } });
    const allSigned = slots.length > 0 && slots.every((s) => s.status === 'ACCEPTED');
    if (allSigned && show.status === 'DRAFT') {
      /* Opening sales is part of locking the booking. An organiser who set
         their own future opening date keeps it. */
      await tx.show.update({
        where: { id: show.id },
        data: { status: 'SCHEDULED', ...(show.isTicketed && !show.ticketingOpensAt ? { ticketingOpensAt: now } : {}) },
      });
    }
    return { agreementId: agreement.id, allSigned };
  });
  if (!result) {
    return NextResponse.json({ error: 'This offer changed or was already answered. Reload the page.' }, { status: 409 });
  }

  await emailSignedAgreement(result.agreementId);
  await notifyUser(venue.ownerId, {
    type: result.allSigned ? 'lineup_split_locked' : 'lineup_split_signed',
    title: result.allSigned ? 'Every act signed — booking confirmed' : 'Lineup offer signed',
    body: result.allSigned
      ? `Every act signed the split agreement for "${show.title}". ${show.isTicketed ? 'Tickets are on sale.' : 'The show is scheduled.'}`
      : `${myLineupSlot.profile.name} signed the split agreement for "${show.title}".`,
    link: `/app/me/shows/${show.slug}/lineup`,
  }).catch(() => undefined);

  return NextResponse.json({ ok: true, status: 'ACCEPTED', showLocked: result.allSigned, agreementId: result.agreementId });
}

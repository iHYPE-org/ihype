import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { notifyUser } from '@/lib/notify';
import { consumeRateLimit, rateLimitKey } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';
import {
  MAX_APPROVED_DEDUCTIONS,
  SPLIT_AGREEMENT_VERSION,
  renderAndHashAgreement,
  validateAgreementTerms,
} from '@/lib/split-agreement';
import { termsFor } from '@/lib/split-agreement-data';

export const dynamic = 'force-dynamic';

const deductionSchema = z.object({
  label: z.string().trim().min(1).max(80),
  capCents: z.number().int().positive().max(100_000_000),
});

const slotSchema = z.object({
  profileId: z.string().cuid(),
  splitPercent: z.number().int().min(1).max(100),
  isHeadliner: z.boolean().optional().default(false),
  guaranteeCents: z.number().int().positive().max(100_000_000).nullable().optional().default(null),
  approvedDeductions: z.array(deductionSchema).max(MAX_APPROVED_DEDUCTIONS).optional().default([]),
});

const schema = z.object({
  slots: z.array(slotSchema)
    .min(1, 'Add the act you are booking.')
    // Every named act is notified on every proposal; an unbounded array was a
    // push-notification cannon (second security scan, 2026-09-02).
    .max(12, 'A lineup holds at most 12 acts.'),
  /** Section 3.7 — the venue's signer personally guarantees payment. */
  guarantorName: z.string().trim().max(120).nullable().optional().default(null),
  /** Section 10.6. */
  juryWaiver: z.boolean().optional().default(false),
  /** Render the agreements for the signer to read, and sign nothing. */
  preview: z.boolean().optional().default(false),
  /** The venue's signature: the signer's full name, typed. */
  signerName: z.string().trim().min(2).max(120).optional(),
  /** The SHA-256 of each act's agreement text as the signer was shown it. */
  agreementHashes: z.record(z.string(), z.string().regex(/^[0-9a-f]{64}$/)).optional(),
}).refine((b) => b.preview || (b.signerName && b.agreementHashes), { message: 'Type your full name to sign the offer.' });

/**
 * POST — the venue SENDS the Lineup Offer, which is its signature on one Show
 * Revenue Split Agreement per act (src/lib/split-agreement.ts, 11.1).
 *
 * Every ticketed show needs one (owner, 2026-09-27), single act included: the
 * venue collects all the ticket money and pays each act itself, and this is
 * the contract that says how much. The signer is shown each act's full text
 * in the composer, and the hash of what they were shown comes back here; the
 * route renders the same terms itself and refuses a mismatch, so nobody signs
 * text that differs from what they read.
 *
 * Sending or revising resets every act to PENDING and marks any earlier
 * agreement for the show superseded (4.5: a change needs both parties). A
 * show already on sale stops selling until every act has signed the revision.
 */
export async function POST(request: Request, { params }: { params: Promise<{ showId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Login required' }, { status: 401 });

  const rl = await consumeRateLimit(rateLimitKey('lineup-propose', session.user.id, null), { limit: 10, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) return NextResponse.json({ error: 'Too many lineup offers — try again later.' }, { status: 429 });

  const { showId } = await params;
  const show = await db.show.findUnique({
    where: { id: showId },
    select: {
      id: true, slug: true, title: true, status: true, startsAt: true, timeZone: true,
      venueProfile: {
        select: {
          id: true, ownerId: true, name: true, paymentReportHoldAt: true,
          addressLine1: true, city: true, stateRegion: true, postalCode: true,
        },
      },
    },
  });
  if (!show) return NextResponse.json({ error: 'Show not found' }, { status: 404 });
  const venue = show.venueProfile;
  /* The VENUE signs, so only its owner may send. An administrator can manage
     a venue's resources but cannot sign a contract in its name. */
  if (!venue || venue.ownerId !== session.user.id) {
    return NextResponse.json({ error: 'Only the venue can send a lineup offer.' }, { status: 403 });
  }
  if (venue.paymentReportHoldAt) {
    return NextResponse.json(
      { error: 'This venue has an unresolved artist payment report. New lineup offers are paused until it is resolved.', code: 'VENUE_PAYMENT_HOLD' },
      { status: 409 },
    );
  }
  if (!['DRAFT', 'SCHEDULED'].includes(show.status) || show.startsAt.getTime() <= Date.now()) {
    return NextResponse.json({ error: 'A lineup offer can only be sent or revised before the show.' }, { status: 400 });
  }

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await request.json());
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.issues[0]?.message ?? 'Invalid lineup offer.' }, { status: 400 });
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const profileIds = body.slots.map((s) => s.profileId);
  if (new Set(profileIds).size !== profileIds.length) {
    return NextResponse.json({ error: 'Each act can only appear once in the lineup.' }, { status: 400 });
  }
  // A single act is the headliner by definition.
  const slots = body.slots.length === 1 ? [{ ...body.slots[0], isHeadliner: true }] : body.slots;
  if (slots.filter((s) => s.isHeadliner).length !== 1) {
    return NextResponse.json({ error: 'Exactly one act must be marked as the headliner.' }, { status: 400 });
  }
  /* 3.6: the venue represents that the percentages it offers total no more
     than 100%. It keeps the rest. */
  const totalSplit = slots.reduce((sum, s) => sum + s.splitPercent, 0);
  if (totalSplit > 100) {
    return NextResponse.json({ error: `The artists' percentages add up to ${totalSplit}%. They can total at most 100%.` }, { status: 400 });
  }

  const profiles = await db.profile.findMany({
    where: { id: { in: profileIds }, type: 'ARTIST' },
    select: { id: true, name: true, ownerId: true },
  });
  if (profiles.length !== profileIds.length) {
    return NextResponse.json({ error: 'One or more acts could not be found.' }, { status: 400 });
  }
  const byId = new Map(profiles.map((p) => [p.id, p]));

  const guarantorName = body.guarantorName?.trim() ? body.guarantorName.trim() : null;
  const signed: { slot: (typeof slots)[number]; hash: string; text: string }[] = [];
  for (const slot of slots) {
    const terms = termsFor({
      show,
      venue,
      artistName: byId.get(slot.profileId)!.name,
      slot: {
        splitPercent: slot.splitPercent,
        guaranteeCents: slot.guaranteeCents ?? null,
        approvedDeductions: slot.approvedDeductions,
        guarantorName,
        juryWaiver: body.juryWaiver,
      },
    });
    const invalid = validateAgreementTerms(terms);
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });
    const { hash, text } = await renderAndHashAgreement(terms);
    if (!body.preview && body.agreementHashes?.[slot.profileId] !== hash) {
      return NextResponse.json(
        { error: 'The agreement text changed after you read it. Review the offer again before sending.', code: 'AGREEMENT_CHANGED' },
        { status: 409 },
      );
    }
    signed.push({ slot, hash, text });
  }

  /* The text the signer reads is rendered HERE, never in the browser: it is
     hashed, and a second renderer is a second chance for one character to
     differ. The composer shows these and sends the hashes back to sign. */
  if (body.preview) {
    return NextResponse.json({
      agreements: signed.map(({ slot, hash, text }) => ({ profileId: slot.profileId, name: byId.get(slot.profileId)!.name, text, hash })),
    });
  }

  const now = new Date();
  const headlinerProfileId = slots.find((s) => s.isHeadliner)!.profileId;
  const signerIp = readClientAddress(request);
  const signerDevice = request.headers.get('user-agent')?.slice(0, 300) ?? null;

  await db.$transaction(async (tx) => {
    await tx.showSplitAgreement.updateMany({ where: { showId: show.id, supersededAt: null }, data: { supersededAt: now } });
    await tx.showLineupSlot.deleteMany({ where: { showId: show.id } });
    await tx.showLineupSlot.createMany({
      data: signed.map(({ slot, hash }) => ({
        showId: show.id,
        profileId: slot.profileId,
        isHeadliner: slot.isHeadliner,
        splitPercent: slot.splitPercent,
        status: 'PENDING' as const,
        guaranteeCents: slot.guaranteeCents ?? null,
        approvedDeductions: slot.approvedDeductions,
        guarantorName,
        juryWaiver: body.juryWaiver,
        agreementVersion: SPLIT_AGREEMENT_VERSION,
        agreementHash: hash,
        venueSignerUserId: session.user.id,
        venueSignerName: body.signerName!,
        venueSignedAt: now,
        venueSignerIp: signerIp,
        venueSignerDevice: signerDevice,
      })),
    });
    await tx.show.update({ where: { id: show.id }, data: { headlinerProfileId } });
  });

  await Promise.all(
    profiles.map((p) =>
      notifyUser(p.ownerId, {
        type: 'lineup_split_proposed',
        title: 'New lineup offer to sign',
        body: `${venue.name} sent you a signed offer for "${show.title}" — read the agreement, then accept or decline.`,
        link: `/app/me/shows/${show.slug}/lineup`,
      }).catch(() => undefined),
    ),
  );

  return NextResponse.json({ ok: true });
}

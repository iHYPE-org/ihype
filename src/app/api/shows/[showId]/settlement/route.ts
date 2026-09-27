import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { notifyUser } from '@/lib/notify';

export const dynamic = 'force-dynamic';

const cents = z.number().int().min(0).max(1_000_000_000);
const schema = z.object({
  /** Admission sold outside iHYPE, including at the door, tax excluded (Split Agreement 6.2). */
  offPlatformCents: cents.optional(),
  offPlatformNote: z.string().trim().max(500).nullable().optional(),
  /** Chargebacks the venue fought with evidence and lost (7.2). */
  chargebacksLostCents: cents.optional(),
  chargebacksNote: z.string().trim().max(500).nullable().optional(),
});

/**
 * PATCH — the venue's own lines on the Settlement Statement: what iHYPE cannot
 * see. Only the venue writes them, and every act on the show is told, because
 * each figure moves what the venue owes them.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ showId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Login required' }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request.' }, { status: 400 });

  const { showId } = await params;
  const show = await db.show.findUnique({
    where: { id: showId },
    select: {
      id: true, slug: true, title: true, startsAt: true,
      venueProfile: { select: { ownerId: true } },
      splitAgreements: { where: { supersededAt: null }, select: { artistProfile: { select: { ownerId: true } } } },
    },
  });
  if (!show || show.venueProfile?.ownerId !== session.user.id) return NextResponse.json({ error: 'Show not found' }, { status: 404 });
  if (show.startsAt.getTime() > Date.now()) {
    return NextResponse.json({ error: 'The statement opens once the show has started.' }, { status: 400 });
  }

  const data = parsed.data;
  await db.showSettlementStatement.upsert({
    where: { showId: show.id },
    create: {
      showId: show.id,
      offPlatformCents: data.offPlatformCents ?? 0,
      offPlatformNote: data.offPlatformNote ?? null,
      chargebacksLostCents: data.chargebacksLostCents ?? 0,
      chargebacksNote: data.chargebacksNote ?? null,
    },
    update: {
      ...(data.offPlatformCents !== undefined && { offPlatformCents: data.offPlatformCents }),
      ...(data.offPlatformNote !== undefined && { offPlatformNote: data.offPlatformNote }),
      ...(data.chargebacksLostCents !== undefined && { chargebacksLostCents: data.chargebacksLostCents }),
      ...(data.chargebacksNote !== undefined && { chargebacksNote: data.chargebacksNote }),
    },
  });

  await Promise.all(show.splitAgreements.map((a) => notifyUser(a.artistProfile.ownerId, {
    type: 'settlement_statement_updated',
    title: 'Settlement statement updated',
    body: `The venue updated the settlement statement for "${show.title}".`,
    link: `/app/me/shows/${show.slug}/settlement`,
  }).catch(() => undefined)));

  return NextResponse.json({ ok: true });
}

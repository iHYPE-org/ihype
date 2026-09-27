import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { PAYOUT_METHOD_KINDS } from '@/lib/split-agreement-data';

export const dynamic = 'force-dynamic';

const schema = z.object({
  profileId: z.string().cuid(),
  kind: z.enum(PAYOUT_METHOD_KINDS),
  /* What the venue needs to send the money: a payment-app handle, a mailing
     address for a check, bank details the artist chooses to share. Shown only
     to the venue of a show the artist has signed for (Split Agreement 5.2). */
  details: z.string().trim().min(3).max(300),
});

/**
 * PUT — where an ARTIST is paid by the venues it plays. Since 2026-09-27 the
 * venue pays each act directly under the signed split agreement, so an act
 * needs no Stripe account, only this. An act cannot sign an offer without it.
 */
export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Login required' }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request.' }, { status: 400 });

  const profile = await db.profile.findUnique({ where: { id: parsed.data.profileId }, select: { ownerId: true, type: true } });
  if (!profile || profile.ownerId !== session.user.id) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  if (profile.type !== 'ARTIST') return NextResponse.json({ error: 'Only an artist profile records where it gets paid.' }, { status: 400 });

  await db.profile.update({
    where: { id: parsed.data.profileId },
    data: { payoutMethodKind: parsed.data.kind, payoutMethodDetails: parsed.data.details, payoutMethodUpdatedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { ADMIN_ALERT_ADDRESS } from '@/lib/env';
import { escapeHtml } from '@/lib/html-escape';
import { sendOperationalEmail } from '@/lib/mailer';
import { notifyUser } from '@/lib/notify';
import { parseApprovedDeductions } from '@/lib/split-agreement-data';
import { settlementDateFor } from '@/lib/split-agreement';
import { refreshVenueHold } from '@/lib/settlement-statement-data';

export const dynamic = 'force-dynamic';

const schema = z.discriminatedUnion('action', [
  /** Venue: the approved deductions it applies, within the caps the act signed. */
  z.object({ action: z.literal('deductions'), amountCents: z.number().int().min(0), note: z.string().trim().max(500).nullable().optional() }),
  /** Venue: "I paid" — amount, date, method and a reference (Split Agreement 5.3). */
  z.object({
    action: z.literal('mark_paid'),
    amountCents: z.number().int().positive().max(1_000_000_000),
    // A real calendar day, not merely the shape of one: `2026-13-45` matched
    // the pattern, became an Invalid Date at the write and threw a 500.
    paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(
      (day) => {
        const at = new Date(`${day}T12:00:00Z`);
        // An Invalid Date THROWS from toISOString; a refine that throws is an exception, not a refusal.
        return !Number.isNaN(at.getTime()) && at.toISOString().slice(0, 10) === day;
      },
      { message: 'paidOn must be a real date (YYYY-MM-DD).' },
    ),
    method: z.string().trim().min(2).max(80),
    reference: z.string().trim().min(1).max(120),
  }),
  /** Act: "I received it" — completes the payment and resolves any report. */
  z.object({ action: z.literal('confirm') }),
  /** Act: "I was not paid" (8.1). */
  z.object({ action: z.literal('report'), note: z.string().trim().min(5).max(1000) }),
]);

/**
 * POST — the payment record for one act under one signed agreement. The
 * venue writes its half (deductions, paid), the act writes its half (confirm,
 * report); neither can write the other's. iHYPE moves no money here: this is
 * the evidence both parties agreed the app would keep (5.3, 8.2).
 */
export async function POST(request: Request, { params }: { params: Promise<{ agreementId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Login required' }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request.' }, { status: 400 });
  const body = parsed.data;

  const { agreementId } = await params;
  const agreement = await db.showSplitAgreement.findUnique({
    where: { id: agreementId },
    select: {
      id: true, supersededAt: true, approvedDeductions: true, venueProfileId: true,
      show: { select: { slug: true, title: true, startsAt: true } },
      venueProfile: { select: { ownerId: true, name: true } },
      artistProfile: { select: { ownerId: true, name: true } },
      payment: true,
    },
  });
  if (!agreement || agreement.supersededAt) return NextResponse.json({ error: 'Agreement not found' }, { status: 404 });
  const isVenue = agreement.venueProfile.ownerId === session.user.id;
  const isArtist = agreement.artistProfile.ownerId === session.user.id;
  if (!isVenue && !isArtist) return NextResponse.json({ error: 'Agreement not found' }, { status: 404 });
  const started = agreement.show.startsAt.getTime() <= Date.now();
  if (!started) return NextResponse.json({ error: 'Payments are recorded once the show has started.' }, { status: 400 });

  const link = `/app/me/shows/${agreement.show.slug}/settlement`;
  const now = new Date();
  const upsert = (data: Record<string, unknown>) => db.artistSharePayment.upsert({
    where: { agreementId: agreement.id },
    create: { agreementId: agreement.id, ...data },
    update: data,
  });

  if (body.action === 'deductions' || body.action === 'mark_paid') {
    if (!isVenue) return NextResponse.json({ error: 'Only the venue records this.' }, { status: 403 });
    if (agreement.payment?.artistConfirmedAt) {
      return NextResponse.json({ error: 'The artist already confirmed this payment.' }, { status: 409 });
    }
    if (body.action === 'deductions') {
      const cap = parseApprovedDeductions(agreement.approvedDeductions).reduce((sum, d) => sum + d.capCents, 0);
      if (body.amountCents > cap) {
        return NextResponse.json({ error: 'Deductions cannot exceed the caps in the signed offer.' }, { status: 400 });
      }
      await upsert({ deductionsAppliedCents: body.amountCents, deductionsNote: body.note ?? null });
    } else {
      await upsert({
        paidMarkedAt: now,
        paidAmountCents: body.amountCents,
        paidOn: new Date(`${body.paidOn}T12:00:00Z`),
        paidMethod: body.method,
        paidReference: body.reference,
      });
    }
    await notifyUser(agreement.artistProfile.ownerId, {
      type: body.action === 'mark_paid' ? 'artist_share_marked_paid' : 'settlement_statement_updated',
      title: body.action === 'mark_paid' ? 'The venue says it paid you' : 'Settlement statement updated',
      body: body.action === 'mark_paid'
        ? `${agreement.venueProfile.name} marked your share for "${agreement.show.title}" as paid. Confirm when it arrives, or report it if it does not.`
        : `${agreement.venueProfile.name} updated the approved deductions for "${agreement.show.title}".`,
      link,
    }).catch(() => undefined);
    return NextResponse.json({ ok: true });
  }

  if (!isArtist) return NextResponse.json({ error: 'Only the artist records this.' }, { status: 403 });

  if (body.action === 'confirm') {
    await upsert({
      artistConfirmedAt: now,
      ...(agreement.payment?.reportedAt && !agreement.payment.reportResolvedAt ? { reportResolvedAt: now } : {}),
    });
    await refreshVenueHold(agreement.venueProfileId, now);
    await notifyUser(agreement.venueProfile.ownerId, {
      type: 'artist_share_confirmed',
      title: 'Payment confirmed',
      body: `${agreement.artistProfile.name} confirmed receiving their share for "${agreement.show.title}".`,
      link,
    }).catch(() => undefined);
    return NextResponse.json({ ok: true });
  }

  // report — allowed once the payment is due or the venue has marked it paid.
  const due = settlementDateFor(agreement.show.startsAt);
  if (!agreement.payment?.paidMarkedAt && now <= due) {
    return NextResponse.json({ error: 'You can report non-payment after the settlement date, or once the venue marks the payment as sent.' }, { status: 400 });
  }
  if (agreement.payment?.artistConfirmedAt) {
    return NextResponse.json({ error: 'You already confirmed this payment.' }, { status: 409 });
  }
  await upsert({ reportedAt: now, reportNote: body.note, reportResolvedAt: null });
  await notifyUser(agreement.venueProfile.ownerId, {
    type: 'artist_share_reported',
    title: 'An artist reported non-payment',
    body: `${agreement.artistProfile.name} reported that their share for "${agreement.show.title}" has not been paid. Unresolved reports pause your ticket sales 14 days after the settlement date.`,
    link,
  }).catch(() => undefined);
  await sendOperationalEmail({
    to: ADMIN_ALERT_ADDRESS,
    subject: `Non-payment reported: ${agreement.artistProfile.name} at ${agreement.venueProfile.name}`,
    text: `${agreement.artistProfile.name} reported non-payment for "${agreement.show.title}".\n\n${body.note}\n\nAgreement ${agreement.id}`,
    html: `<p>${escapeHtml(agreement.artistProfile.name)} reported non-payment for &ldquo;${escapeHtml(agreement.show.title)}&rdquo;.</p><p>${escapeHtml(body.note)}</p><p>Agreement ${escapeHtml(agreement.id)}</p>`,
    deliveryType: 'split_nonpayment_report',
  }, 'split non-payment report').catch(() => undefined);
  return NextResponse.json({ ok: true });
}

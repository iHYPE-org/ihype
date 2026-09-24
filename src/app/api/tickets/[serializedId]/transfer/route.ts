import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { sendGenericEmail } from '@/lib/mailer';
import { consumeRateLimit, rateLimitKey } from '@/lib/rate-limit';
import { buildTicketVerificationUrl, createSerializedTicketId } from '@/lib/tickets';
import { log } from '@/lib/logger';
import { escapeHtml } from '@/lib/html-escape';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ serializedId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Login required' }, { status: 401 });
  }

  const rl = await consumeRateLimit(rateLimitKey('ticket-transfer', session.user.id, null), { limit: 10, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });

  const { serializedId } = await params;

  let body: { toEmail?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const toEmail = body.toEmail?.trim().toLowerCase();
  if (!toEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
  }

  const order = await db.ticketOrder.findUnique({
    where: { id: serializedId },
    include: {
      show: { select: { title: true, startsAt: true } },
      tickets: { select: { serializedId: true, holderName: true, status: true } },
    },
  });

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  if (order.buyerUserId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (order.status !== 'CAPTURED') {
    return NextResponse.json({ error: 'Only captured orders can be transferred' }, { status: 400 });
  }
  if (order.tickets.some((t) => t.status === 'SCANNED')) {
    return NextResponse.json({ error: 'A ticket that has been scanned at the door cannot be transferred' }, { status: 400 });
  }

  /* The recipient becomes the OWNER, not just the addressee (second security
     scan, 2026-09-02). Rotating the serialized ids stopped the sender's old
     QR working, but `buyerUserId` stayed on the sender, and the QR page and
     transfer-code route authorise on that column — so the sender could pull
     the NEW QR from their own ticket list and scan first, or transfer the same
     order again to a second buyer. Ownership moves to the recipient's account
     when one exists for the address, and is cleared otherwise so the sender
     holds nothing; the recipient's email link is then the only way in. */
  const recipient = await db.user.findUnique({ where: { email: toEmail }, select: { id: true } });
  if (recipient?.id === session.user.id) {
    return NextResponse.json({ error: 'That is your own address' }, { status: 400 });
  }

  // Reissue every ticket in the order with a fresh serializedId rather than
  // just emailing the recipient the existing one. Every ticket surface
  // (the QR page, the scan endpoints) looks tickets up by serializedId with
  // no other ownership check, so the original buyer — who may have already
  // opened/screenshotted/printed the QR before initiating this transfer —
  // would otherwise still hold a fully valid, scannable copy after
  // "transferring" it; whoever scanned first would win. Rotating the id
  // makes the old QR 404 immediately, and only the freshly emailed one
  // works. holderName falls back to the recipient's email since a transfer
  // doesn't collect a real name.
  const recipientName = toEmail.split('@')[0];
  const now = new Date();
  // The new ids exist before anything is written, so the email can carry
  // them either side of the commit (see the ordering note below).
  const newIds = order.tickets.map(() => createSerializedTicketId());

  const send = () => sendGenericEmail({
    to: toEmail,
    subject: `Ticket transfer: ${order.show.title}`,
    text: `You've received tickets for ${order.show.title}!\n\n${newIds.map((id) => `• #${id} — ${buildTicketVerificationUrl(id)}`).join('\n')}\n\nOriginal confirmation: ${order.confirmationCode}`,
    html: `<p>You've received tickets for <strong>${escapeHtml(order.show.title)}</strong>!</p><ul>${newIds.map((id) => `<li><a href="${escapeHtml(buildTicketVerificationUrl(id))}">#${id}</a></li>`).join('')}</ul><p>Confirmation: <strong>${order.confirmationCode}</strong></p>`,
  });

  /* THE EMAIL IS NOT A NOTICE FOR EVERY RECIPIENT, SO IT IS NOT ALWAYS SENT
     AFTER (2026-09-24, DESIGN_SYNC row 513). It used to go after the commit
     with `.catch(() => {})`, and the sender was told "the recipient has been
     emailed" whatever the provider answered. For an address with no account
     the email is the ONLY copy of the new codes — the order moves to nobody
     who can open it — so a failed send stranded the tickets. So for that
     recipient the email goes FIRST, and a failure transfers nothing. For a
     member it goes after, because the tickets are in their wallet either way
     and a failed notice is reported rather than fatal. */
  if (!recipient) {
    try {
      await send();
    } catch (error) {
      log.error('[api/tickets/transfer]', error instanceof Error ? error : { error: String(error) }, 'transfer email failed; nothing was transferred');
      return NextResponse.json(
        { error: `The email to ${toEmail} could not be sent, so nothing was transferred. Try again in a minute.` },
        { status: 502 },
      );
    }
  }

  /* ONE TRANSACTION, AND IT KILLS ANY LIVE TRANSFER CODE (row 513). The
     rotation, the ownership move and the code expiry used to be separate
     writes with no expiry at all — so a transfer code minted before an email
     transfer stayed live, and whoever held it could claim the order back from
     the new owner. The claim route also checks that the code's creator still
     owns the order; this is the half that stops the code existing at all. */
  await db.$transaction(async (tx) => {
    for (const [index, t] of order.tickets.entries()) {
      await tx.ticket.update({
        where: { serializedId: t.serializedId },
        data: {
          serializedId: newIds[index]!,
          holderName: recipientName,
          holderEmail: toEmail,
          reassignCount: { increment: 1 },
          reassignedAt: now,
        },
      });
    }
    await tx.ticketOrder.update({
      where: { id: serializedId },
      data: {
        transferredAt: now,
        transferredToEmail: toEmail,
        buyerUserId: recipient?.id ?? null,
        buyerEmail: toEmail,
      },
    });
    await tx.ticketTransferCode.updateMany({
      where: { ticketOrderId: serializedId, claimedAt: null, expiresAt: { gt: now } },
      data: { expiresAt: now },
    });
  });

  let emailed = true;
  if (recipient) {
    try {
      await send();
    } catch (error) {
      emailed = false;
      log.error('[api/tickets/transfer]', error instanceof Error ? error : { error: String(error) }, 'transfer notice failed; tickets are in the recipient wallet');
    }
  }

  return NextResponse.json({ transferred: true, emailed });
}

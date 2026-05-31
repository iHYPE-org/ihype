import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { sendIssuedTicketEmail } from '@/lib/mailer';
import { canManageOwnedResource } from '@/lib/permissions';
import { db } from '@/lib/db';
import { consumeRateLimit, rateLimitKey } from '@/lib/rate-limit';
import { buildTicketQrCodeDataUrl, buildTicketVerificationUrl, formatTicketStatus } from '@/lib/tickets';
import { formatCurrencyFromCents } from '@/lib/ticketing';

const schema = z.object({
  newHolderName: z.string().min(2),
  newHolderEmail: z.string().email(),
  resalePriceCents: z.coerce.number().int().positive()
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ serializedId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Login required' }, { status: 401 });
  }

  const rl = await consumeRateLimit(rateLimitKey('ticket-reassign', session.user.id, null), { limit: 20, windowMs: 60 * 60 * 1000 });
  if (!rl.allowed) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });

  try {
    const { serializedId } = await params;
    const body = schema.parse(await request.json());

    const ticket = await db.ticket.findUnique({
      where: { serializedId },
      include: {
        show: {
          include: {
            venueProfile: true
          }
        },
        ticketOrder: true,
        venueProfile: true
      }
    });

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    if (!canManageOwnedResource(session, ticket.venueProfile?.ownerId)) {
      return NextResponse.json({ error: 'Only the venue can reassign this ticket.' }, { status: 403 });
    }

    const perTicketValueCents = Math.round(ticket.ticketOrder.subtotalCents / ticket.ticketOrder.quantity);
    if (body.resalePriceCents !== perTicketValueCents) {
      return NextResponse.json(
        { error: `Tickets can only be reassigned at face value of ${formatCurrencyFromCents(perTicketValueCents)}.` },
        { status: 400 }
      );
    }

    const updatedTicket = await db.ticket.update({
      where: { id: ticket.id },
      data: {
        holderName: body.newHolderName.trim(),
        holderEmail: body.newHolderEmail.trim().toLowerCase(),
        reassignedAt: new Date(),
        reassignedByUserId: session.user.id,
        reassignCount: { increment: 1 }
      }
    });

    const qrCodeDataUrl = await buildTicketQrCodeDataUrl(updatedTicket.serializedId);
    const verificationUrl = buildTicketVerificationUrl(updatedTicket.serializedId);

    await sendIssuedTicketEmail({
      email: updatedTicket.holderEmail,
      name: updatedTicket.holderName,
      showTitle: ticket.show.title,
      venueName: ticket.show.venueProfile?.name,
      eventOpensAtLabel: ticket.show.startsAt.toLocaleString('en-US'),
      totalChargeLabel: formatCurrencyFromCents(perTicketValueCents),
      tickets: [
        {
          label: 'Reassigned ticket',
          serializedId: updatedTicket.serializedId,
          verificationUrl,
          qrCodeDataUrl
        }
      ]
    });

    return NextResponse.json({
      ticket: {
        id: updatedTicket.id,
        serializedId: updatedTicket.serializedId,
        status: formatTicketStatus(updatedTicket.status),
        verificationUrl,
        qrCodeDataUrl
      },
      message: 'Ticket reassigned at face value and emailed to the new holder.'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? 'Invalid reassignment payload' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Could not reassign this ticket.' }, { status: 500 });
  }
}

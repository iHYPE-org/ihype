import { TicketOrderStatus, TicketStatus } from '@prisma/client';
import { db } from '@/lib/db';
import type { ShowProductionPlan } from '@/lib/show-composer';

type ShowAccessInput = {
  showId: string;
  isTicketed: boolean;
  creatorId: string;
  userId?: string | null;
  role?: string | null;
  email?: string | null;
};

export async function canViewerAccessShowMedia({
  showId,
  isTicketed,
  creatorId,
  userId,
  role,
  email,
}: ShowAccessInput) {
  if (!isTicketed) return true;
  if (!userId) return false;
  if (role === 'ADMIN' || userId === creatorId) return true;

  const normalizedEmail = email?.trim().toLowerCase() || null;
  const [purchasedOrder, assignedTicket] = await Promise.all([
    db.ticketOrder.findFirst({
      where: {
        showId,
        buyerUserId: userId,
        status: TicketOrderStatus.CAPTURED,
      },
      select: { id: true },
    }),
    normalizedEmail
      ? db.ticket.findFirst({
          where: {
            showId,
            holderEmail: { equals: normalizedEmail, mode: 'insensitive' },
            status: { in: [TicketStatus.VALID, TicketStatus.SCANNED] },
            ticketOrder: { status: TicketOrderStatus.CAPTURED },
          },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);

  return Boolean(purchasedOrder || assignedTicket);
}

export function protectShowProductionPlan(
  productionPlan: ShowProductionPlan,
  showId: string,
): ShowProductionPlan {
  return {
    ...productionPlan,
    mediaItems: productionPlan.mediaItems.map((item) => ({
      ...item,
      url: `/api/shows/${encodeURIComponent(showId)}/media/${encodeURIComponent(item.mediaId)}`,
    })),
  };
}

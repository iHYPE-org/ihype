import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

const PROMOTER_COMMISSION_RATE = 0.05;

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profiles = await db.profile.findMany({
      where: { ownerId: session.user.id },
      select: { id: true, hexId: true, name: true, type: true }
    });
    if (profiles.length === 0) {
      return NextResponse.json({
        clicks: 0,
        signups: 0,
        ticketSales: 0,
        grossRevenueCents: 0,
        estimatedCommissionCents: 0,
        profiles: []
      });
    }

    const profileIds = profiles.map((p) => p.id);
    const hexIds = profiles.map((p) => p.hexId);

    const [orders, clicks, signups, payoutSum] = await Promise.all([
      db.ticketOrder.findMany({
        where: {
          affiliatePromoterProfileId: { in: profileIds },
          status: { in: ['CAPTURED', 'RESERVED'] }
        },
        select: {
          id: true,
          subtotalCents: true,
          totalChargeCents: true,
          promoterPayoutCents: true,
          status: true,
          createdAt: true
        }
      }),
      db.auditLog.count({
        where: {
          action: { in: ['referral_click', 'affiliate_link_click'] },
          OR: [
            { entityId: { in: hexIds } },
            { entityId: { in: profileIds } }
          ]
        }
      }),
      db.auditLog.count({
        where: {
          action: 'user_registered',
          OR: hexIds.map((h) => ({ metadata: { path: ['referralCode'], equals: h } }))
        }
      }).catch(() => 0),
      db.accountsPayableEntry.aggregate({
        where: {
          profileId: { in: profileIds },
          category: 'PROMOTER_AFFILIATE'
        },
        _sum: { amountCents: true }
      })
    ]);

    const ticketSales = orders.length;
    const grossRevenueCents = orders.reduce((acc, o) => acc + (o.subtotalCents ?? 0), 0);
    const recordedCommissionCents = payoutSum._sum.amountCents ?? 0;
    const estimatedCommissionCents = recordedCommissionCents > 0
      ? recordedCommissionCents
      : Math.round(grossRevenueCents * PROMOTER_COMMISSION_RATE);

    return NextResponse.json({
      clicks,
      signups,
      ticketSales,
      grossRevenueCents,
      estimatedCommissionCents,
      profiles: profiles.map((p) => ({ id: p.id, hexId: p.hexId, name: p.name, type: p.type }))
    });
  } catch (err) {
    console.error('[api/referrals/stats] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

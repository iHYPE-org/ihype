import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isAdminSession } from '@/lib/permissions';
import { requireRecentAdminReauth } from '@/lib/admin-confirmation';
import { AD_CAMPAIGN_STATUSES, type AdCampaignStatus } from '@/lib/ad-vetting';
import { notifyAdvertiser } from '@/lib/ad-campaign-notify';
import { createAdCampaignCheckoutSession } from '@/lib/stripe';
import { log } from '@/lib/logger';

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!isAdminSession(session)) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    // Ad.status is a plain String column, so an unrecognised filter doesn't
    // error — it silently matches nothing, which reads in the admin UI as
    // "there are no campaigns." Reject the typo instead of showing an
    // empty queue.
    const requestedStatus = searchParams.get('status');
    if (requestedStatus && !AD_CAMPAIGN_STATUSES.includes(requestedStatus as AdCampaignStatus)) {
      return NextResponse.json({ error: 'Unknown status filter.' }, { status: 400 });
    }
    const status = requestedStatus ?? undefined;

    const ads = await db.ad.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      include: { advertiser: { select: { name: true, email: true } }, slot: { select: { name: true } } },
    });

    return NextResponse.json({ ads });
  } catch (err) {
    console.error('[api/admin/ads] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!isAdminSession(session) || !session?.user?.id) {
      return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
    }

    // Step-up auth: approving here opens a real Stripe authorization against
    // the advertiser's card, and rejecting kills a paid campaign. Same gate
    // as the other money- and enforcement-touching admin routes.
    const reauthed = await requireRecentAdminReauth(session.user.id);
    if (!reauthed) {
      return NextResponse.json({ requiresReauth: true }, { status: 401 });
    }

    const { id, status } = await request.json();
    if (!id || !['APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    }

    // An admin "approving" a manual-review campaign means "clear to start
    // billing" — same as automated vetting clearing (POST /api/advertise/
    // campaigns) — not "live." AWAITING_PAYMENT until the advertiser
    // actually authorizes payment via the checkout link this triggers.
    const storedStatus = status === 'APPROVED' ? 'AWAITING_PAYMENT' : status;

    let ad = await db.ad.update({
      where: { id },
      data: { status: storedStatus },
      include: { advertiser: { select: { id: true, email: true } } },
    });

    let checkoutUrl: string | undefined;
    if (storedStatus === 'AWAITING_PAYMENT') {
      try {
        const checkout = await createAdCampaignCheckoutSession({
          adId: ad.id,
          amountCents: ad.budgetCents,
          title: ad.title,
          advertiserEmail: ad.advertiser.email,
        });
        ad = await db.ad.update({
          where: { id: ad.id },
          data: { stripePaymentIntentId: checkout.paymentIntentId },
          include: { advertiser: { select: { id: true, email: true } } },
        });
        checkoutUrl = checkout.checkoutUrl;
      } catch (error) {
        log.error('[admin/ads]', error instanceof Error ? error : null, 'Checkout session creation failed');
      }
    }

    notifyAdvertiser(
      ad.advertiser.id,
      ad.advertiser.email,
      ad.title,
      storedStatus,
      'Reviewed by an iHYPE admin.',
      checkoutUrl,
    );

    return NextResponse.json({ ad });
  } catch (err) {
    console.error('[api/admin/ads] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

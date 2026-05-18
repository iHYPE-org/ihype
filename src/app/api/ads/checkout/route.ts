import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', { apiVersion: '2025-02-24.acacia' });

const TIER_PRICES: Record<string, number> = {
  featured: 5000,  // $50
  premium: 15000,  // $150
};

export async function POST(request: NextRequest) {
  await auth();
  const { adId } = await request.json() as { adId: string };

  const ad = await db.adSubmission.findUnique({ where: { id: adId }, select: { id: true, tier: true, status: true, advertiserName: true } });
  if (!ad) return NextResponse.json({ error: 'Ad not found.' }, { status: 404 });
  if (ad.status !== 'approved') return NextResponse.json({ error: 'Ad must be approved before payment.' }, { status: 400 });

  const priceAmount = TIER_PRICES[ad.tier ?? ''];
  if (!priceAmount) return NextResponse.json({ url: null, message: 'Standard tier is free — no payment needed.' });

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://ihype.org';
  const checkout = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price_data: { currency: 'usd', unit_amount: priceAmount, recurring: { interval: 'month' }, product_data: { name: `iHYPE ${ad.tier} ad — ${ad.advertiserName}` } }, quantity: 1 }],
    success_url: `${baseUrl}/advertise?success=1&adId=${adId}`,
    cancel_url: `${baseUrl}/advertise?cancelled=1`,
    metadata: { adId },
  });

  return NextResponse.json({ url: checkout.url });
}

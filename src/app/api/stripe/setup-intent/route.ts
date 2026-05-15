import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getOrCreateStripeCustomer, getStripe, isStripeConfigured } from '@/lib/stripe';

/**
 * POST /api/stripe/setup-intent
 *
 * Creates a Stripe SetupIntent so a fan can save a payment method.
 * Returns { clientSecret } for use with Stripe.js on the frontend.
 */
export async function POST() {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: 'Payments are not configured on this server.' }, { status: 503 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Login required.' }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      stripeCustomerId: true
    }
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found.' }, { status: 404 });
  }

  const customerId = await getOrCreateStripeCustomer({
    userId: user.id,
    email: user.email ?? '',
    name: user.name,
    existingCustomerId: user.stripeCustomerId
  });

  if (!user.stripeCustomerId) {
    await db.user.update({
      where: { id: user.id },
      data: { stripeCustomerId: customerId }
    });
  }

  const stripe = getStripe();
  const setupIntent = await stripe.setupIntents.create({
    customer: customerId,
    payment_method_types: ['card'],
    usage: 'off_session'
  });

  return NextResponse.json({ clientSecret: setupIntent.client_secret });
}

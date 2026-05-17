import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { recordAuditEvent } from '@/lib/audit';
import { isPaymentProcessingConfigured } from '@/lib/payments';
import { getStripe, getOrCreateStripeCustomer } from '@/lib/stripe';
import { consumeRateLimit } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';

export const dynamic = 'force-dynamic';

const ALLOWED_AMOUNTS_CENTS = new Set([100, 300, 500]);
const MIN_CUSTOM_CENTS = 100;
const MAX_CUSTOM_CENTS = 50000;

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: 'Sign in to send a tip.' }, { status: 401 });
  }
  if (!isPaymentProcessingConfigured()) {
    return NextResponse.json({ error: 'Tips are unavailable right now.' }, { status: 503 });
  }

  const clientAddress = readClientAddress(request);
  const rate = await consumeRateLimit(`tips:${session.user.id}:${clientAddress ?? 'anon'}`, {
    limit: 10,
    windowMs: 60 * 60 * 1000
  });
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Too many tip attempts. Try again later.' }, { status: 429 });
  }

  let body: { profileId?: string; amountCents?: number } = {};
  try {
    body = (await request.json()) as { profileId?: string; amountCents?: number };
  } catch {
    // ignore
  }

  const profileId = typeof body.profileId === 'string' ? body.profileId : '';
  const amountCents = Number(body.amountCents);
  if (!profileId || !Number.isFinite(amountCents) || amountCents <= 0) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  const isPreset = ALLOWED_AMOUNTS_CENTS.has(amountCents);
  const isCustom = amountCents >= MIN_CUSTOM_CENTS && amountCents <= MAX_CUSTOM_CENTS;
  if (!isPreset && !isCustom) {
    return NextResponse.json({ error: 'Tip amount out of range.' }, { status: 400 });
  }

  const profile = await db.profile.findUnique({
    where: { id: profileId },
    select: {
      id: true,
      name: true,
      type: true,
      ownerId: true,
      stripeConnectAccountId: true,
      stripeConnectOnboarded: true
    }
  });
  if (!profile) {
    return NextResponse.json({ error: 'Artist not found.' }, { status: 404 });
  }
  if (profile.ownerId === session.user.id) {
    return NextResponse.json({ error: 'You cannot tip your own profile.' }, { status: 400 });
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, stripeCustomerId: true }
  });
  if (!user) {
    return NextResponse.json({ error: 'User not found.' }, { status: 404 });
  }

  const stripe = getStripe();
  const customerId = await getOrCreateStripeCustomer({
    userId: user.id,
    email: user.email ?? session.user.email,
    name: user.name ?? null,
    existingCustomerId: user.stripeCustomerId
  });
  if (customerId !== user.stripeCustomerId) {
    await db.user.update({ where: { id: user.id }, data: { stripeCustomerId: customerId } });
  }

  const transferData =
    profile.stripeConnectAccountId && profile.stripeConnectOnboarded
      ? { destination: profile.stripeConnectAccountId }
      : undefined;

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: 'usd',
    customer: customerId,
    description: `Tip for ${profile.name}`,
    metadata: {
      kind: 'artist_tip',
      profileId: profile.id,
      tipperUserId: user.id
    },
    automatic_payment_methods: { enabled: true },
    ...(transferData ? { transfer_data: transferData } : {})
  });

  await recordAuditEvent({
    actorUserId: user.id,
    action: 'artist_tip_created',
    entityType: 'profile',
    entityId: profile.id,
    ipAddress: clientAddress,
    metadata: {
      amountCents,
      paymentIntentId: paymentIntent.id,
      profileName: profile.name,
      hasConnect: Boolean(transferData)
    }
  });

  return NextResponse.json({
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
    amountCents
  });
}

export async function GET(request: NextRequest) {
  const profileId = new URL(request.url).searchParams.get('profileId');
  if (!profileId) {
    return NextResponse.json({ error: 'profileId required' }, { status: 400 });
  }
  const count = await db.auditLog.count({
    where: { action: 'artist_tip_created', entityType: 'profile', entityId: profileId }
  });
  return NextResponse.json({ count });
}

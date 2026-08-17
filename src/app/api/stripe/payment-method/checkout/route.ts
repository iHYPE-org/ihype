import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getPaymentProcessingReadiness } from '@/lib/payments';
import { arePaymentsEnabledRuntime } from '@/lib/runtime-flags';
import { createPaymentMethodSetupSession, getOrCreateStripeCustomer } from '@/lib/stripe';

const schema = z.object({
  returnPath: z.string().regex(/^\/(?!\/)[^\r\n]*$/).default('/app/me?panel=tickets'),
});

export async function POST(request: Request) {
  if (!(await arePaymentsEnabledRuntime())) {
    return NextResponse.json({ error: 'New payment operations are temporarily paused.' }, { status: 503 });
  }
  if (!getPaymentProcessingReadiness().ready) {
    return NextResponse.json({ error: 'Paid ticketing is not configured on this server.' }, { status: 503 });
  }

  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Login required.' }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid return path.' }, { status: 400 });

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, stripeCustomerId: true },
  });
  if (!user?.email) {
    return NextResponse.json({ error: 'Add and verify an email address before saving a payment method.' }, { status: 400 });
  }

  const customerId = await getOrCreateStripeCustomer({
    userId: user.id,
    email: user.email,
    name: user.name,
    existingCustomerId: user.stripeCustomerId,
  });
  if (!user.stripeCustomerId) {
    await db.user.update({ where: { id: user.id }, data: { stripeCustomerId: customerId } });
  }

  const checkoutUrl = await createPaymentMethodSetupSession({
    userId: user.id,
    stripeCustomerId: customerId,
    returnPath: parsed.data.returnPath,
  });
  return NextResponse.json({ checkoutUrl });
}

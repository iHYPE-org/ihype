import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { consumeRateLimit } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const session = await auth();
  const clientAddress = readClientAddress(request);
  const rateKey = session?.user?.id
    ? `premium-interest:user:${session.user.id}`
    : `premium-interest:ip:${clientAddress ?? 'unknown'}`;
  const rate = await consumeRateLimit(rateKey, {
    limit: 5,
    windowMs: 60 * 60 * 1000
  });
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
  }

  let body: { email?: string; note?: string } = {};
  try {
    body = (await request.json()) as { email?: string; note?: string };
  } catch {
    // ignore
  }

  const rawEmail = typeof body.email === 'string' ? body.email.trim() : '';
  const email = rawEmail.length > 0 ? rawEmail : session?.user?.email ?? '';
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Valid email required.' }, { status: 400 });
  }

  await db.premiumInterest.create({
    data: {
      userId: session?.user?.id ?? null,
      email
    }
  });

  return NextResponse.json({ ok: true });
}

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { log } from '@/lib/logger';
import { sendMagicLinkEmail } from '@/lib/magic-link';
import { consumeRateLimit } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';

export async function POST(request: Request) {
  try {
    const clientAddress = readClientAddress(request);
    const rl = await consumeRateLimit(`magic-link:${clientAddress}`, { limit: 5, windowMs: 15 * 60 * 1000 });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many attempts. Wait a few minutes and try again.' },
        { status: 429 },
      );
    }

    let email: string;
    try {
      const body = await request.json();
      email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    } catch {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    }

    if (!email) return NextResponse.json({ error: 'Email is required.' }, { status: 400 });

    const user = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) {
      // Do not reveal whether an account exists.
      return NextResponse.json({ ok: true });
    }

    await sendMagicLinkEmail(user.id, email);

    return NextResponse.json({ ok: true });
  } catch (error) {
    log.error('[magic-link]', error instanceof Error ? error : null, 'Magic link request failed');
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { log } from '@/lib/logger';
import { sendMagicLinkEmail } from '@/lib/magic-link';
import { isAllowedAdminEmail } from '@/lib/admin-allowlist';
import { consumeRateLimit } from '@/lib/rate-limit';
import { readClientAddress } from '@/lib/request-meta';

export async function POST(request: Request) {
  try {
    const clientAddress = readClientAddress(request);
    // Longer DO deadline than the default. This bucket is keyed per client
    // IP on an endpoint one person hits a few times a week, so its Durable
    // Object is evicted between uses and nearly every call pays a cold
    // start — that produced 67 timeouts against the 750ms default, each one
    // dropping sign-in to the halved KV limit. Sign-in already takes a
    // moment; an extra second on a cold object is invisible next to being
    // rate-limited out of your own account.
      const rl = await consumeRateLimit(`magic-link:${clientAddress}`, { limit: 5, windowMs: 15 * 60 * 1000, timeoutMs: 2500 });
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

    const user = await db.user.findUnique({ where: { email }, select: { id: true, role: true } });
    if (!user) {
      // Do not reveal whether an account exists.
      return NextResponse.json({ ok: true });
    }

    /* The admin signs in with a passkey and nothing else (owner, 2026-08-24:
       "Admin Mode needs passkey only security"). A magic link is exactly the
       email-deliverable credential that policy exists to remove, so the admin
       account never gets one — answered with the same ok:true as an unknown
       address, because "this address is the admin" is itself information. */
    if (user.role === 'ADMIN' || isAllowedAdminEmail(email)) {
      log.warn('magic-link: refused for admin account (passkey-only policy)');
      return NextResponse.json({ ok: true });
    }

    await sendMagicLinkEmail(user.id, email);

    return NextResponse.json({ ok: true });
  } catch (error) {
    log.error('[magic-link]', error instanceof Error ? error : null, 'Magic link request failed');
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
